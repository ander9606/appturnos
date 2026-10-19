'use strict';

const ReportesModel = require('./reportes.model');
const TrabajadoresModel = require('../trabajadores/trabajadores.model');
const AppError = require('../../utils/AppError');
const { generarInsights } = require('./reportes.insights');
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
   * Resumen del período para gestores: costo vs período anterior, a dónde se va,
   * asistencia a turnos y avisos. `verPagos` (admin y jefe de nómina) controla
   * si entra nómina; sin él, la respuesta solo trae lo de turnos.
   */
  async resumen(empresaId, { desde, hasta }, { verPagos }) {
    const previo = rangoAnterior(desde, hasta);
    const [tAct, tPrev, cobAct, nAct, nPrev] = await Promise.all([
      ReportesModel.resumenTurnos(empresaId, desde, hasta),
      ReportesModel.resumenTurnos(empresaId, previo.desde, previo.hasta),
      ReportesModel.coberturaTurnos(empresaId, desde, hasta),
      verPagos ? this.calcularNomina(empresaId, desde, hasta) : null,
      verPagos ? this.calcularNomina(empresaId, previo.desde, previo.hasta) : null,
    ]);

    const turnos = aNumeros(tAct, ['convocados', 'completados', 'no_presentados', 'costo', 'bonos']);
    const costoTurnosPrev = Number(tPrev.costo) || 0;
    const total = redondear(turnos.costo + (nAct?.costo || 0));
    const totalPrev = redondear(costoTurnosPrev + (nPrev?.costo || 0));
    const costo = {
      total,
      previo: totalPrev,
      delta_pct: totalPrev > 0 ? redondear(((total - totalPrev) / totalPrev) * 100) : null,
      turnos: redondear(turnos.costo),
      nomina: nAct ? nAct.costo : null,
    };

    const plazas = Number(cobAct.plazas) || 0;
    const cubiertas = Number(cobAct.cubiertas) || 0;
    const cobertura = { plazas, cubiertas, pct: plazas > 0 ? redondear((cubiertas / plazas) * 100) : null };

    const nominaInfo = nAct && {
      ...nAct,
      top_extras: [...nAct.detalle].filter((d) => d.horas_extra > 0).sort((a, b) => b.horas_extra - a.horas_extra).slice(0, 3),
    };

    return {
      rango: { desde, hasta },
      previo,
      costo,
      desglose: { ...nAct?.desglose, bonos: redondear(turnos.bonos), turnos: redondear(turnos.costo - turnos.bonos) },
      turnos: {
        convocados: turnos.convocados,
        completados: turnos.completados,
        no_presentados: turnos.no_presentados,
      },
      cobertura,
      insights: generarInsights({ costo, nomina: nominaInfo, turnos, cobertura }),
    };
  },

  /** Historial individual de un trabajador: turnos + registros de nómina. */
  async historialTrabajador(empresaId, trabajadorId, { desde, hasta }) {
    const trabajador = await TrabajadoresModel.obtenerPorId(empresaId, trabajadorId);
    if (!trabajador) throw new AppError('Trabajador no encontrado', 404);

    const turnos = await ReportesModel.turnosDeTrabajador(empresaId, trabajadorId, desde, hasta);
    const registros = await ReportesModel.registrosDeTrabajador(
      empresaId,
      trabajadorId,
      desde,
      hasta
    );
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
        dias_nomina: registros.length,
      },
    };
  },
};

module.exports = ReportesService;
module.exports.rangoAnterior = rangoAnterior;
