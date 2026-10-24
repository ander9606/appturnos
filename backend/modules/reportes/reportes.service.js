'use strict';

const ReportesModel = require('./reportes.model');
const TrabajadoresModel = require('../trabajadores/trabajadores.model');
const AppError = require('../../utils/AppError');
const { generarInsightsTurnos, generarInsightsNomina, generarInsightsPersonas, UMBRALES } = require('./reportes.insights');
const { valorHora, desglosarPagoNomina, calcularSalarioBasePeriodo, diasComerciales } = require('../../utils/laboralUtils');

function redondear(n) {
  return Math.round(n * 100) / 100;
}

/** Convierte a número los campos indicados de una fila. */
function aNumeros(fila, campos) {
  const copia = { ...fila };
  for (const campo of campos) copia[campo] = Number(copia[campo]) || 0;
  return copia;
}

/** Mismo número de días que [desde, hasta], terminando justo antes de `desde`. */
function rangoAnterior(desde, hasta) {
  const DIA = 24 * 60 * 60 * 1000;
  const ini = Date.parse(`${desde}T00:00:00Z`);
  const dias = Math.round((Date.parse(`${hasta}T00:00:00Z`) - ini) / DIA) + 1;
  const iso = (ms) => new Date(ms).toISOString().slice(0, 10);
  return { desde: iso(ini - dias * DIA), hasta: iso(ini - DIA) };
}

// Personas
const MIN_DIAS_HORAS = 3;          // días con horas para que el promedio cuente
const VENTANA_BANCA_DIAS = 180;    // "ya hizo este cargo" = lo hizo en los últimos 6 meses

/** Promedio (0-5) de las calificaciones de turnos, su cambio vs el período anterior, la distribución por estrellas y lo que falta calificar. */
function formatearCalificaciones(act, prev) {
  const prom = (f) => (Number(f.calificadas) > 0 && f.promedio != null ? redondear(Number(f.promedio)) : null);
  const promedio = prom(act);
  const previo = prom(prev);
  return {
    promedio,
    previo,
    delta: promedio != null && previo != null ? redondear(promedio - previo) : null,
    calificadas: Number(act.calificadas) || 0,
    sin_calificar: Number(act.sin_calificar) || 0,
    distribucion: { 1: Number(act.e1) || 0, 2: Number(act.e2) || 0, 3: Number(act.e3) || 0, 4: Number(act.e4) || 0, 5: Number(act.e5) || 0 },
  };
}

/** Costo del período contra el anterior de su mismo lado. delta_pct es null si antes no hubo costo. */
function comparar(total, previo) {
  total = redondear(total);
  previo = redondear(previo);
  return { total, previo, delta_pct: previo > 0 ? redondear(((total - previo) / previo) * 100) : null };
}

/** Promedio, más larga y más corta; null si no hubo jornadas en el rango. */
function formatearJornadas({ resumen, mayor, menor }) {
  const n = Number(resumen.jornadas) || 0;
  if (!n) return null;
  const ext = (e) => e && { trabajador_id: e.trabajador_id, nombre: e.nombre, apellido: e.apellido, fecha: e.fecha, horas: redondear(Number(e.horas)) };
  return { jornadas: n, promedio: redondear(Number(resumen.promedio)), mas_larga: ext(mayor), mas_corta: ext(menor) };
}

const ReportesService = {
  /** Asistencia por período: turnos (por estado) y días de nómina. */
  async asistencia(empresaId, { desde, hasta }) {
    const turnos = (await ReportesModel.asistenciaTurnos(empresaId, desde, hasta)).map((f) =>
      aNumeros(f, ['total_turnos', 'completados', 'no_presentados', 'en_progreso', 'confirmados'])
    );
    const nomina = (await ReportesModel.asistenciaNomina(empresaId, desde, hasta)).map((f) =>
      aNumeros(f, ['dias_registrados'])
    );
    return { rango: { desde, hasta }, turnos, nomina };
  },

  /**
   * Costo de nómina del rango, por trabajador y por concepto.
   * Mismo criterio que liquidacion.service.js: un asalariado cuesta su sueldo
   * prorrateado al rango completo, no lo que sumen sus horas_ordinarias — si no,
   * este reporte subestima el costo real de un asalariado con pocas horas
   * registradas en el rango.
   */
  async calcularNomina(empresaId, desde, hasta) {
    const filas = await ReportesModel.horasNominaPorTrabajador(empresaId, desde, hasta);
    const diasRango = diasComerciales(desde, hasta);
    const desglose = { ordinario: 0, nocturno: 0, extras: 0, festivo: 0 };
    let costo = 0;
    let horasExtra = 0;

    const detalle = filas.map((f) => {
      const vh = valorHora(f);
      const pago = desglosarPagoNomina(f, vh, hasta, { salarioFijo: f.salario_base != null });
      const ordinario = calcularSalarioBasePeriodo({
        tarifaHora: f.tarifa_hora,
        salarioBase: f.salario_base,
        horasOrdinarias: f.horas_ordinarias,
        valorHoraTrabajador: vh,
        diasPeriodo: diasRango,
      });
      const extras = pago.pago_extra_diurno + pago.pago_extra_nocturno;
      const total = redondear(ordinario + pago.pago_nocturno + extras + pago.pago_festivo);
      const horas = (Number(f.horas_extra_diurnas) || 0) + (Number(f.horas_extra_nocturnas) || 0);
      desglose.ordinario += ordinario;
      desglose.nocturno += pago.pago_nocturno;
      desglose.extras += extras;
      desglose.festivo += pago.pago_festivo;
      costo += total;
      horasExtra += horas;
      return { trabajador_id: f.trabajador_id, nombre: f.nombre, apellido: f.apellido, total, horas_extra: horas };
    });

    for (const k of Object.keys(desglose)) desglose[k] = redondear(desglose[k]);
    return { costo: redondear(costo), desglose, horas_extra: redondear(horasExtra), detalle };
  },

  /**
   * Costo de mano de obra por período: turnos + nómina.
   * El detalle por trabajador solo lo ve quien ve nómina (verPagos).
   */
  async costos(empresaId, { desde, hasta }, { verPagos = true } = {}) {
    const turnos = await ReportesModel.costoTurnos(empresaId, desde, hasta);
    const nomina = verPagos ? await this.calcularNomina(empresaId, desde, hasta) : null;
    const costoTurnos = Number(turnos.costo) || 0;
    return {
      rango: { desde, hasta },
      turnos: {
        turnos_completados: Number(turnos.turnos_completados) || 0,
        costo: redondear(costoTurnos),
      },
      nomina: nomina && {
        trabajadores: nomina.detalle.length,
        costo: nomina.costo,
        detalle: nomina.detalle.map(({ horas_extra, ...resto }) => resto),
      },
      costo_total: redondear(costoTurnos + (nomina?.costo || 0)),
    };
  },

  /**
   * Resumen del período para gestores. Turnos y nómina se analizan por separado (cada uno con su
   * costo, su comparación con el período anterior, su desglose y sus avisos) y nunca se suman.
   * `verPagos` (admin y jefe de nómina) controla si entra la parte de nómina; sin él, `nomina` es null.
   */
  async resumen(empresaId, { desde, hasta }, { verPagos }) {
    const previo = rangoAnterior(desde, hasta);
    const [tAct, tPrev, cobAct, calAct, calPrev, nAct, nPrev] = await Promise.all([
      ReportesModel.resumenTurnos(empresaId, desde, hasta),
      ReportesModel.resumenTurnos(empresaId, previo.desde, previo.hasta),
      ReportesModel.coberturaTurnos(empresaId, desde, hasta),
      ReportesModel.resumenCalificaciones(empresaId, desde, hasta),
      ReportesModel.resumenCalificaciones(empresaId, previo.desde, previo.hasta),
      verPagos ? this.calcularNomina(empresaId, desde, hasta) : null,
      verPagos ? this.calcularNomina(empresaId, previo.desde, previo.hasta) : null,
    ]);

    // ── Turnos ──
    const t = aNumeros(tAct, ['convocados', 'completados', 'no_presentados', 'costo', 'bonos']);
    const costoTurnos = comparar(t.costo, Number(tPrev.costo) || 0);
    const plazas = Number(cobAct.plazas) || 0;
    const cubiertas = Number(cobAct.cubiertas) || 0;
    const cobertura = { plazas, cubiertas, pct: plazas > 0 ? redondear((cubiertas / plazas) * 100) : null };
    const calificaciones = formatearCalificaciones(calAct, calPrev);
    const turnos = {
      costo: costoTurnos,
      desglose: { tarifas: redondear(t.costo - t.bonos), bonos: redondear(t.bonos) },
      convocados: t.convocados,
      completados: t.completados,
      no_presentados: t.no_presentados,
      cobertura,
      calificaciones,
      insights: generarInsightsTurnos({ costo: costoTurnos, turnos: t, cobertura, calificaciones }),
    };

    // ── Nómina ──
    let nomina = null;
    if (nAct) {
      const costoNomina = comparar(nAct.costo, nPrev.costo);
      const top_extras = [...nAct.detalle].filter((d) => d.horas_extra > 0).sort((a, b) => b.horas_extra - a.horas_extra).slice(0, 3);
      nomina = {
        costo: costoNomina,
        desglose: nAct.desglose,
        insights: generarInsightsNomina({ costo: costoNomina, nomina: { ...nAct, top_extras } }),
      };
    }

    return { rango: { desde, hasta }, previo, turnos, nomina };
  },

  /**
   * Personas, en dos bloques que no se mezclan. Turnos: duración de los turnos y cómo se reparten turnos y
   * plata dentro de cada cargo. Nómina (solo con verPagos): horas promedio por persona y duración de la jornada.
   */
  async personas(empresaId, { desde, hasta }, { verPagos }) {
    const DIA = 24 * 60 * 60 * 1000;
    const dias = Math.round((Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / DIA) + 1;
    const semanas = Math.max(1, dias / 7);

    const [filasHoras, filasTurnos, jNomina, jTurnos, filasCal] = await Promise.all([
      verPagos ? ReportesModel.horasTotalesPorTrabajador(empresaId, desde, hasta) : [],
      ReportesModel.turnosPorCargoYTrabajador(empresaId, desde, hasta, VENTANA_BANCA_DIAS),
      verPagos ? ReportesModel.jornadas(empresaId, desde, hasta, 'nomina') : null,
      ReportesModel.jornadas(empresaId, desde, hasta, 'turnos'),
      ReportesModel.calificacionesPorTrabajador(empresaId, desde, hasta),
    ]);
    const calificadas = filasCal.map((f) => ({ trabajador_id: f.trabajador_id, nombre: f.nombre, apellido: f.apellido, n: Number(f.n) || 0, promedio: redondear(Number(f.promedio)) }));
    const calDe = new Map(calificadas.map((c) => [c.trabajador_id, { promedio: c.promedio, n: c.n }]));

    // Horas: con menos de MIN_DIAS_HORAS días trabajados el promedio no dice nada
    let horas = null;
    if (verPagos) {
      const ranking = filasHoras
        .map((f) => ({
          trabajador_id: f.trabajador_id, nombre: f.nombre, apellido: f.apellido,
          horas: redondear(Number(f.horas) || 0), dias: Number(f.dias) || 0,
        }))
        .filter((f) => f.dias >= MIN_DIAS_HORAS)
        .map((f) => ({ ...f, prom_dia: redondear(f.horas / f.dias), prom_semana: redondear(f.horas / semanas) }))
        .sort((a, b) => b.prom_semana - a.prom_semana);
      const promEquipo = ranking.length ? redondear(ranking.reduce((s, r) => s + r.prom_semana, 0) / ranking.length) : null;
      horas = {
        prom_semana_equipo: promEquipo,
        ranking,
        mas: ranking.slice(0, 5),
        menos: ranking.slice(-5).reverse().filter((r) => !ranking.slice(0, 5).includes(r)),
      };
    }

    const porCargo = new Map();
    for (const f of filasTurnos) {
      if (!porCargo.has(f.cargo_id)) porCargo.set(f.cargo_id, { cargo_id: f.cargo_id, cargo: f.cargo, personas: [] });
      porCargo.get(f.cargo_id).personas.push({
        trabajador_id: f.trabajador_id, nombre: f.nombre, apellido: f.apellido,
        turnos: Number(f.turnos) || 0, pago: redondear(Number(f.pago) || 0),
        calificacion: calDe.get(f.trabajador_id) ?? null,
      });
    }
    const cargos = [...porCargo.values()].map((c) => {
      c.personas.sort((a, b) => b.pago - a.pago || b.turnos - a.turnos);
      return {
        ...c,
        total_turnos: c.personas.reduce((s, p) => s + p.turnos, 0),
        total_pago: redondear(c.personas.reduce((s, p) => s + p.pago, 0)),
        rotable: c.personas.length >= UMBRALES.MIN_PERSONAS_ROTAR,
      };
    }).filter((c) => c.total_turnos > 0).sort((a, b) => b.total_pago - a.total_pago);

    // Mejores y peores calificados: solo con calificaciones suficientes para que el promedio diga algo
    const juzgables = calificadas.filter((c) => c.n >= UMBRALES.CALIF_PERSONA_MIN).sort((a, b) => b.promedio - a.promedio || b.n - a.n);
    const mejores = juzgables.slice(0, 3);
    const peores = juzgables.slice(3).slice(-3).reverse();
    const insights = generarInsightsPersonas({ horas, cargos, calificadas });
    return {
      rango: { desde, hasta },
      turnos: { jornadas: formatearJornadas(jTurnos), cargos, calificaciones: { mejores, peores }, insights: insights.turnos },
      nomina: verPagos ? { jornadas: jNomina && formatearJornadas(jNomina), horas, insights: insights.nomina } : null,
    };
  },

  /** Historial individual de un trabajador: turnos + registros de nómina. */
  // verPagos (admin, jefe de nómina y nomina): sin él, registros_nomina queda
  // null — las horas ordinarias/extra/festivas y la novedad (notas médicas)
  // de un trabajador son dato de nómina, no algo que jefe_turnos deba ver.
  async historialTrabajador(empresaId, trabajadorId, { desde, hasta }, { verPagos }) {
    const trabajador = await TrabajadoresModel.obtenerPorId(empresaId, trabajadorId);
    if (!trabajador) throw new AppError('Trabajador no encontrado', 404);

    const turnos = await ReportesModel.turnosDeTrabajador(empresaId, trabajadorId, desde, hasta);
    const registros = verPagos
      ? await ReportesModel.registrosDeTrabajador(empresaId, trabajadorId, desde, hasta)
      : null;
    const pagoTurnos = turnos.reduce((suma, t) => suma + (Number(t.pago_total) || 0), 0);

    return {
      trabajador: {
        id: trabajador.id,
        nombre: trabajador.nombre,
        apellido: trabajador.apellido,
        cedula: trabajador.cedula,
        tipo: trabajador.tipo,
        cargo: trabajador.cargo,
      },
      rango: { desde, hasta },
      turnos,
      registros_nomina: registros,
      resumen: {
        total_turnos: turnos.length,
        pago_turnos: redondear(pagoTurnos),
        dias_nomina: registros ? registros.length : null,
      },
    };
  },
};

module.exports = ReportesService;
module.exports.rangoAnterior = rangoAnterior;
