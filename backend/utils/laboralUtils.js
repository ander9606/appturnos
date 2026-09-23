'use strict';

/**
 * Utilidades de ley laboral colombiana.
 *
 * Cubre dos cosas:
 *  1. Cálculo de festivos (fijos, Ley Emiliani y los basados en Pascua).
 *  2. Desglose de horas trabajadas en ordinarias / extra / nocturnas / festivo
 *     a partir de la hora de entrada y salida.
 *
 * Referencia de recargos (ver APP-TURNOS-SPEC/02-BASE-DATOS.md):
 *   Jornada ordinaria        42 h/semana
 *   Horario nocturno         19:00 – 06:00 (21:00 antes del 25-dic-2025)
 *   Extra diurna             ×1.25
 *   Extra nocturna           ×1.75
 *   Recargo nocturno         +35 % (×0.35 asalariado, ×1.35 por tarifa_hora)
 *   Dominical/festivo        ×1.80 / ×1.90 / ×2.00 según fecha (Ley 2466 de 2025)
 */

const {
  JORNADA_SEMANAL_HORAS,
  HORA_INICIO_NOCTURNO_VIGENCIAS,
  RECARGO_FESTIVO_VIGENCIAS,
  HORA_FIN_NOCTURNO,
  JORNADA_CONTINUA_UMBRAL_HORAS,
  DURACION_ALMUERZO_MIN,
  HORAS_MES_NOMINA,
  RECARGOS,
  SMMLV_COP,
  DEDUCCION_SALUD,
  DEDUCCION_PENSION,
  FONDO_SOLIDARIDAD_TRAMOS,
  SUBSIDIO_TRANSPORTE_COP,
  SUBSIDIO_TRANSPORTE_TOPE_SMMLV,
} = require('../config/constants');

const MIN_POR_DIA = 24 * 60;

// ─────────────────────────────────────────────────────────────
// Festivos
// ─────────────────────────────────────────────────────────────

/**
 * Domingo de Pascua para un año dado (algoritmo de Meeus/Butcher, gregoriano).
 * @returns {Date} fecha en UTC.
 */
function calcularPascua(anio) {
  const a = anio % 19;
  const b = Math.floor(anio / 100);
  const c = anio % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(anio, mes - 1, dia));
}

/** Suma días a una fecha UTC sin mutar la original. */
function sumarDias(fecha, dias) {
  const d = new Date(fecha.getTime());
  d.setUTCDate(d.getUTCDate() + dias);
  return d;
}

/** Mueve una fecha al lunes siguiente (Ley Emiliani). Si ya es lunes, no cambia. */
function trasladarALunes(fecha) {
  const diaSemana = fecha.getUTCDay(); // 0=domingo, 1=lunes
  if (diaSemana === 1) return fecha;
  const offset = diaSemana === 0 ? 1 : 8 - diaSemana;
  return sumarDias(fecha, offset);
}

/** Formatea una fecha UTC como 'YYYY-MM-DD'. */
function aISODate(fecha) {
  return fecha.toISOString().slice(0, 10);
}

/**
 * Lista de festivos colombianos para un año (formato 'YYYY-MM-DD').
 * Calculada dinámicamente, sirve para cualquier año.
 */
function festivosDeAnio(anio) {
  const fijos = [
    [1, 1], // Año Nuevo
    [5, 1], // Día del Trabajo
    [7, 20], // Independencia
    [8, 7], // Batalla de Boyacá
    [12, 8], // Inmaculada Concepción
    [12, 25], // Navidad
  ].map(([mes, dia]) => new Date(Date.UTC(anio, mes - 1, dia)));

  // Festivos que se trasladan al lunes (Ley Emiliani)
  const emiliani = [
    [1, 6], // Reyes Magos
    [3, 19], // San José
    [6, 29], // San Pedro y San Pablo
    [8, 15], // Asunción de la Virgen
    [10, 12], // Día de la Raza
    [11, 1], // Todos los Santos
    [11, 11], // Independencia de Cartagena
  ].map(([mes, dia]) => trasladarALunes(new Date(Date.UTC(anio, mes - 1, dia))));

  const pascua = calcularPascua(anio);
  const basadosEnPascua = [
    sumarDias(pascua, -3), // Jueves Santo
    sumarDias(pascua, -2), // Viernes Santo
    trasladarALunes(sumarDias(pascua, 39)), // Ascensión del Señor
    trasladarALunes(sumarDias(pascua, 60)), // Corpus Christi
    trasladarALunes(sumarDias(pascua, 68)), // Sagrado Corazón
  ];

  // Set elimina colisiones: dos festivos pueden caer el mismo día tras el
  // traslado al lunes (ej. San Pedro y Sagrado Corazón el 30/06/2025).
  return [...new Set([...fijos, ...emiliani, ...basadosEnPascua].map(aISODate))].sort();
}

// Cache por año para no recalcular en cada consulta.
const _cacheFestivos = new Map();

/**
 * Indica si una fecha cae en domingo — se usa para la clasificación
 * ocasional/habitual (Art. 180/181 CST), que solo aplica a domingos, no a
 * festivos entre semana.
 * @param {string|Date} fecha  'YYYY-MM-DD' o Date.
 * @returns {boolean}
 */
function esDomingo(fecha) {
  const iso = typeof fecha === 'string' ? fecha.slice(0, 10) : aISODate(fecha);
  return new Date(`${iso}T00:00:00Z`).getUTCDay() === 0;
}

/**
 * Indica si una fecha es festivo o domingo (ambos llevan recargo dominical/festivo).
 * @param {string|Date} fecha  'YYYY-MM-DD' o Date.
 * @returns {boolean}
 */
function esDiaFestivo(fecha) {
  const iso = typeof fecha === 'string' ? fecha.slice(0, 10) : aISODate(fecha);
  const anio = Number(iso.slice(0, 4));

  // Domingo
  const d = new Date(`${iso}T00:00:00Z`);
  if (d.getUTCDay() === 0) return true;

  if (!_cacheFestivos.has(anio)) {
    _cacheFestivos.set(anio, new Set(festivosDeAnio(anio)));
  }
  return _cacheFestivos.get(anio).has(iso);
}

// ─────────────────────────────────────────────────────────────
// Cálculo de horas
// ─────────────────────────────────────────────────────────────

/** Convierte 'HH:MM' o 'HH:MM:SS' a minutos desde medianoche. */
function horaAMinutos(hora) {
  const [h, m] = String(hora).split(':').map(Number);
  return h * 60 + (m || 0);
}

/**
 * Fila de una tabla de vigencias (constants.js) que aplica en `fecha`
 * ('YYYY-MM-DD' o Date; sin fecha = hoy en Colombia).
 */
function vigenteEn(tabla, fecha) {
  const iso = fecha instanceof Date
    ? aISODate(fecha)
    : fecha ? String(fecha).slice(0, 10) : new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Bogota' });
  return tabla.find((v) => v.desde <= iso);
}

/** Hora (0-23) en que empieza el trabajo nocturno en `fecha` (Ley 2466: 19 desde 25-dic-2025). */
function horaInicioNocturno(fecha) {
  return vigenteEn(HORA_INICIO_NOCTURNO_VIGENCIAS, fecha).hora;
}

/** Multiplicador de la hora dominical/festiva en `fecha` (Ley 2466: 1.80 → 1.90 → 2.00). */
function recargoFestivo(fecha) {
  return vigenteEn(RECARGO_FESTIVO_VIGENCIAS, fecha).factor;
}

/** True si el minuto del día (0-1439) cae en horario nocturno (horaInicio:00–06:00). */
function esMinutoNocturno(minutoDelDia, horaInicio = horaInicioNocturno()) {
  const h = Math.floor((minutoDelDia % MIN_POR_DIA) / 60);
  return h >= horaInicio || h < HORA_FIN_NOCTURNO;
}

function redondear(horas) {
  return Math.round(horas * 100) / 100;
}

/**
 * Minutos (índices absolutos dentro de [inicio, fin), pueden superar 1439 si
 * el turno cruza medianoche) que se descuentan como almuerzo.
 *
 * Por defecto, si la jornada supera JORNADA_CONTINUA_UMBRAL_HORAS se asume
 * que el trabajador tomó su hora de almuerzo (Art. 167 CST) y se descuentan
 * DURACION_ALMUERZO_MIN minutos — tomados del FINAL DEL BLOQUE DIURNO (se
 * escanea hacia atrás desde `fin` saltando minutos nocturnos) para no
 * comerse horas nocturnas ya causadas. `jornadaContinua: true` (el
 * trabajador indica que NO tomó almuerzo al cerrar) omite el descuento.
 *
 * @param {number} inicio  Minuto de inicio del turno (ver horaAMinutos).
 * @param {number} fin     Minuto de fin (> inicio; ya ajustado si cruza medianoche).
 * @param {boolean} jornadaContinua
 * @param {number} [horaInicioNoct]  Ver horaInicioNocturno(); por defecto la regla de hoy.
 * @returns {Set<number>}
 */
function calcularMinutosAlmuerzo(inicio, fin, jornadaContinua, horaInicioNoct = horaInicioNocturno()) {
  const totalMin = fin - inicio;
  let pendiente =
    !jornadaContinua && totalMin > JORNADA_CONTINUA_UMBRAL_HORAS * 60 ? DURACION_ALMUERZO_MIN : 0;

  const minutos = new Set();
  for (let m = fin - 1; m >= inicio && pendiente > 0; m--) {
    if (!esMinutoNocturno(m, horaInicioNoct)) {
      minutos.add(m);
      pendiente--;
    }
  }
  return minutos;
}

/**
 * Desglosa una jornada en sus componentes para liquidación de nómina.
 *
 * @param {object} params
 * @param {string} params.horaEntrada  'HH:MM' o 'HH:MM:SS'.
 * @param {string} params.horaSalida   'HH:MM' o 'HH:MM:SS'. Si es menor que la
 *                                      entrada se asume que cruza medianoche.
 * @param {string|Date} [params.fecha] Fecha de la jornada (para detectar festivo).
 * @param {boolean} [params.esFestivo] Fuerza el tratamiento festivo; si se omite
 *                                      se deduce de `fecha`.
 * @returns {{
 *   horas_ordinarias: number,
 *   horas_extra_diurnas: number,
 *   horas_extra_nocturnas: number,
 *   horas_nocturnas: number,
 *   horas_festivo: number,
 *   es_festivo: number,
 *   total_horas: number
 * }}
 */
/**
 * @param {number} [params.horasOrdinariasAcumuladas=0]
 *   Horas ordinarias + nocturnas ya registradas esta semana (lunes–ayer).
 *   Cuando se supera JORNADA_SEMANAL_HORAS el resto del turno pasa a extra.
 * @param {boolean} [params.jornadaContinua=false]
 *   Si la jornada supera JORNADA_CONTINUA_UMBRAL_HORAS, por defecto se asume
 *   que el trabajador tomó su hora de almuerzo (Art. 167 CST) y se descuentan
 *   DURACION_ALMUERZO_MIN minutos de la jornada. Marcar `jornadaContinua: true`
 *   (el trabajador indica que NO tomó almuerzo al cerrar) omite ese descuento.
 * @param {boolean} [params.recargoFestivo=true]
 *   Si el día es domingo/festivo, controla si sus horas llevan el recargo
 *   festivo (Art. 179 CST) o se pagan como ordinarias/nocturnas normales.
 *   En falso para un domingo "ocasional" (≤2 domingos trabajados en el mes
 *   calendario, Art. 180 CST): el trabajador recibe el descanso compensatorio
 *   pero no el recargo en dinero para esas horas. `es_festivo` en el
 *   resultado no cambia — sigue marcando que el día fue domingo/festivo
 *   (dispara el compensatorio) independientemente de este parámetro.
 */
function calcularHoras({
  horaEntrada, horaSalida, fecha, esFestivo, horasOrdinariasAcumuladas = 0, jornadaContinua = false,
  recargoFestivo = true,
} = {}) {
  const vacio = {
    horas_ordinarias: 0,
    horas_extra_diurnas: 0,
    horas_extra_nocturnas: 0,
    horas_nocturnas: 0,
    horas_festivo: 0,
    es_festivo: 0,
    total_horas: 0,
  };

  if (!horaEntrada || !horaSalida) return vacio;

  const inicio = horaAMinutos(horaEntrada);
  let fin = horaAMinutos(horaSalida);
  if (fin < inicio) fin += MIN_POR_DIA; // cruza medianoche

  const totalMin = fin - inicio;
  if (totalMin <= 0) return vacio;

  const festivo =
    typeof esFestivo === 'boolean' ? esFestivo : fecha ? esDiaFestivo(fecha) : false;

  // El inicio del nocturno depende de la fecha trabajada (Ley 2466); sin fecha, regla de hoy.
  const horaInicioNoct = horaInicioNocturno(fecha);
  const esAlmuerzo = calcularMinutosAlmuerzo(inicio, fin, jornadaContinua, horaInicioNoct);

  let ordinariasDiurnas = 0;
  let ordinariasNocturnas = 0;
  let extraDiurnas = 0;
  let extraNocturnas = 0;
  let festivoMin = 0;

  // Minutos ordinarios restantes para completar la jornada semanal (42 h).
  const minOrdinarioRestante = Math.max(0, (JORNADA_SEMANAL_HORAS - horasOrdinariasAcumuladas) * 60);

  let minutosContados = 0; // excluye almuerzo del acumulado semanal
  for (let m = inicio; m < fin; m++) {
    if (esAlmuerzo.has(m)) continue;
    const esOrdinario = minutosContados < minOrdinarioRestante;
    const nocturno = esMinutoNocturno(m, horaInicioNoct);

    if (festivo && recargoFestivo) {
      festivoMin++;
    } else if (esOrdinario) {
      if (nocturno) ordinariasNocturnas++;
      else ordinariasDiurnas++;
    } else if (nocturno) {
      extraNocturnas++;
    } else {
      extraDiurnas++;
    }
    minutosContados++;
  }

  return {
    // Las ordinarias nocturnas siguen siendo ordinarias para el conteo de jornada,
    // pero se reportan aparte porque devengan el recargo nocturno (+35 %).
    horas_ordinarias: redondear(ordinariasDiurnas / 60),
    horas_extra_diurnas: redondear(extraDiurnas / 60),
    horas_extra_nocturnas: redondear(extraNocturnas / 60),
    horas_nocturnas: redondear(ordinariasNocturnas / 60),
    horas_festivo: redondear(festivoMin / 60),
    es_festivo: festivo ? 1 : 0,
    total_horas: redondear((totalMin - esAlmuerzo.size) / 60),
  };
}

// ─────────────────────────────────────────────────────────────
// Pago de nómina
// ─────────────────────────────────────────────────────────────

/**
 * Valor de la hora ordinaria de un trabajador.
 * Usa `salario_base` (÷HORAS_MES_NOMINA = 210) si está definido; si no, cae a `tarifa_hora`.
 * Un trabajador solo debería tener uno de los dos, pero si por error quedan
 * ambos cargados, el salario mensual manda — es el dato "de contrato".
 */
function valorHora(trabajador) {
  if (trabajador.salario_base != null) {
    return Number(trabajador.salario_base) / HORAS_MES_NOMINA;
  }
  if (trabajador.tarifa_hora != null) return Number(trabajador.tarifa_hora);
  return 0;
}

/**
 * Salario base de un trabajador para un período de nómina.
 *
 * Un trabajador con salario mensual asignado (`salario_base`) cobra su sueldo
 * fijo COMPLETO cada período, prorrateado por días — nunca depende de cuántas
 * `horas_ordinarias` haya marcado ese período (jornada corta no le descuenta
 * el sueldo; eso se maneja aparte con descuentos manuales por inasistencia).
 * Las horas extra/recargo se calculan por separado sobre las horas reales
 * (ver desglosarPagoNomina) y se SUMAN a este salario base.
 *
 * Un trabajador por `tarifa_hora` (sin salario mensual) sigue cobrando por
 * hora realmente ordinaria trabajada — no hay salario fijo que prorratear.
 * Si por error quedan ambos campos cargados, `salario_base` manda (igual
 * que en `valorHora`) — evita que una tarifa vieja/residual le baje el sueldo
 * fijo a alguien que ya pasó a nómina mensual.
 *
 * @param {object} params
 * @param {number|null} params.salarioBase       trabajador.salario_base (mensual)
 * @param {number} params.horasOrdinarias        Solo se usa si es por tarifa_hora.
 * @param {number} params.valorHoraTrabajador    Solo se usa si es por tarifa_hora.
 * @param {number} params.diasPeriodo            Días calendario del período.
 */
function calcularSalarioBasePeriodo({ salarioBase, horasOrdinarias, valorHoraTrabajador, diasPeriodo }) {
  if (salarioBase != null) {
    return (Number(salarioBase) || 0) / 30 * Number(diasPeriodo);
  }
  return (Number(horasOrdinarias) || 0) * (Number(valorHoraTrabajador) || 0);
}

/**
 * Pago total de un desglose de horas aplicando los recargos de ley.
 * Las horas ordinarias se pagan a 1.0; el resto aplica su recargo.
 * @param {object} desglose  Campos horas_ordinarias, horas_extra_diurnas,
 *                           horas_extra_nocturnas, horas_nocturnas, horas_festivo.
 * @param {number} valorHoraTrabajador
 */
function calcularPagoNomina(desglose, valorHoraTrabajador, fecha) {
  return desglosarPagoNomina(desglose, valorHoraTrabajador, fecha).total;
}

/**
 * Igual que calcularPagoNomina() pero devuelve el monto de cada concepto por
 * separado en vez de solo la suma — para que la UI pueda mostrar "salario
 * base $X + horas extra $Y" en vez de un solo total sin desglosar.
 * @param {object} desglose  Campos horas_ordinarias, horas_extra_diurnas,
 *                           horas_extra_nocturnas, horas_nocturnas, horas_festivo.
 * @param {number} valorHoraTrabajador
 * @param {string|Date} [fecha]  Fecha que fija el recargo dominical/festivo
 *   (normalmente el fin del período); sin fecha, el vigente hoy.
 * @param {object} [opciones]
 * @param {boolean} [opciones.salarioFijo=false]  true si el trabajador cobra
 *   salario_base: su sueldo ya paga la hora nocturna ordinaria, así que solo
 *   se suma el recargo (×0.35). Por tarifa_hora se paga base + recargo (×1.35).
 *   ponytail: las horas festivas llegan sumadas por período, así que un período
 *   que cruce un 1-jul usa una sola tasa — upgrade path: sumar horas_festivo
 *   × recargoFestivo(fecha) por registro en el SQL de liquidación.
 */
function desglosarPagoNomina(desglose, valorHoraTrabajador, fecha, { salarioFijo = false } = {}) {
  const n = (v) => Number(v) || 0;
  const vh = Number(valorHoraTrabajador) || 0;
  const recargo_festivo = recargoFestivo(fecha);
  const recargo_nocturno = (salarioFijo ? 0 : 1) + RECARGOS.NOCTURNO_ADICIONAL;

  const pago_ordinario      = vh * n(desglose.horas_ordinarias);
  const pago_nocturno       = vh * recargo_nocturno * n(desglose.horas_nocturnas);
  const pago_extra_diurno   = vh * RECARGOS.EXTRA_DIURNA * n(desglose.horas_extra_diurnas);
  const pago_extra_nocturno = vh * RECARGOS.EXTRA_NOCTURNA * n(desglose.horas_extra_nocturnas);
  const pago_festivo        = vh * recargo_festivo * n(desglose.horas_festivo);

  return {
    recargo_festivo,
    recargo_nocturno,
    pago_ordinario,
    pago_nocturno,
    pago_extra_diurno,
    pago_extra_nocturno,
    pago_festivo,
    total: pago_ordinario + pago_nocturno + pago_extra_diurno + pago_extra_nocturno + pago_festivo,
  };
}

// ─────────────────────────────────────────────────────────────
// Descuentos de ley (contrato laboral)
// ─────────────────────────────────────────────────────────────

/**
 * Descuentos de ley sobre el ingreso base de cotización (IBC) de un
 * trabajador con contrato laboral: salud (4%) + pensión (4%, + aporte al
 * Fondo de Solidaridad Pensional si el IBC ≥ 4 SMMLV).
 * ARL y caja de compensación no se incluyen: en Colombia van 100% por
 * cuenta del empleador, no se descuentan del trabajador.
 * @param {number} ibc  Ingreso base de cotización (normalmente el pago bruto del período).
 */
function calcularDeducciones(ibc) {
  const base = Number(ibc) || 0;
  const salud = base * DEDUCCION_SALUD;

  const smmlvDevengados = base / SMMLV_COP;
  const tramo = [...FONDO_SOLIDARIDAD_TRAMOS]
    .reverse()
    .find((t) => smmlvDevengados >= t.desdeSmmlv);
  const tasaPension = DEDUCCION_PENSION + (tramo ? tramo.tasa : 0);
  const pension = base * tasaPension;

  const total = salud + pension;
  return { salud, pension, total, neto: base - total };
}

/**
 * Auxilio de transporte (Ley 15/1959) prorateado a los días del período.
 * Solo aplica si el salario mensual equivalente del trabajador no supera
 * SUBSIDIO_TRANSPORTE_TOPE_SMMLV salarios mínimos. No es IBC — no lleva
 * descuento de salud/pensión.
 * @param {number} salarioMensualEquivalente  valorHora(trabajador) * HORAS_MES_NOMINA.
 * @param {number} diasPeriodo  días calendario del período de nómina.
 */
function calcularSubsidioTransporte(salarioMensualEquivalente, diasPeriodo) {
  const salario = Number(salarioMensualEquivalente) || 0;
  if (salario <= 0 || salario > SMMLV_COP * SUBSIDIO_TRANSPORTE_TOPE_SMMLV) return 0;
  // Multiplicar antes de dividir: 249095 / 30 * 30 da 249094.9999… en punto flotante.
  return (SUBSIDIO_TRANSPORTE_COP * diasPeriodo) / 30;
}

module.exports = {
  calcularPascua,
  festivosDeAnio,
  esDiaFestivo,
  esDomingo,
  calcularHoras,
  calcularMinutosAlmuerzo,
  horaAMinutos,
  horaInicioNocturno,
  recargoFestivo,
  valorHora,
  calcularPagoNomina,
  desglosarPagoNomina,
  calcularSalarioBasePeriodo,
  calcularDeducciones,
  calcularSubsidioTransporte,
};
