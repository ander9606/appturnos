'use strict';

/**
 * Utilidades de ley laboral colombiana.
 *
 * Cubre dos cosas:
 *  1. Cálculo de festivos (fijos, Ley Emiliani y los basados en Pascua).
 *  2. Desglose de horas trabajadas en ordinarias / extra / nocturnas / festivo
 *     a partir de la hora de entrada y salida.
 *
 * Referencia de recargos (ver 02-BASE-DATOS.md):
 *   Jornada ordinaria        8 h/día
 *   Horario nocturno         21:00 – 06:00
 *   Extra diurna             ×1.25
 *   Extra nocturna           ×1.75
 *   Recargo nocturno         ×1.35
 *   Dominical/festivo        ×1.75 (diurno) / ×2.10 (nocturno)
 */

const {
  JORNADA_ORDINARIA_HORAS,
  HORA_INICIO_NOCTURNO,
  HORA_FIN_NOCTURNO,
} = require('../config/constants');

const MIN_POR_DIA = 24 * 60;
const MIN_JORNADA = JORNADA_ORDINARIA_HORAS * 60;

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

/** True si el minuto del día (0-1439) cae en horario nocturno (21:00–06:00). */
function esMinutoNocturno(minutoDelDia) {
  const h = Math.floor((minutoDelDia % MIN_POR_DIA) / 60);
  return h >= HORA_INICIO_NOCTURNO || h < HORA_FIN_NOCTURNO;
}

function redondear(horas) {
  return Math.round(horas * 100) / 100;
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
function calcularHoras({ horaEntrada, horaSalida, fecha, esFestivo } = {}) {
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
  if (fin <= inicio) fin += MIN_POR_DIA; // cruza medianoche

  const totalMin = fin - inicio;
  if (totalMin <= 0) return vacio;

  const festivo =
    typeof esFestivo === 'boolean' ? esFestivo : fecha ? esDiaFestivo(fecha) : false;

  let ordinariasDiurnas = 0;
  let ordinariasNocturnas = 0;
  let extraDiurnas = 0;
  let extraNocturnas = 0;
  let festivoMin = 0;

  for (let m = inicio; m < fin; m++) {
    const trabajados = m - inicio; // minutos acumulados de la jornada
    const esOrdinario = trabajados < MIN_JORNADA;
    const nocturno = esMinutoNocturno(m);

    if (festivo) {
      festivoMin++;
    } else if (esOrdinario) {
      if (nocturno) ordinariasNocturnas++;
      else ordinariasDiurnas++;
    } else if (nocturno) {
      extraNocturnas++;
    } else {
      extraDiurnas++;
    }
  }

  return {
    // Las ordinarias nocturnas siguen siendo ordinarias para el conteo de jornada,
    // pero se reportan aparte porque devengan el recargo nocturno (×1.35).
    horas_ordinarias: redondear(ordinariasDiurnas / 60),
    horas_extra_diurnas: redondear(extraDiurnas / 60),
    horas_extra_nocturnas: redondear(extraNocturnas / 60),
    horas_nocturnas: redondear(ordinariasNocturnas / 60),
    horas_festivo: redondear(festivoMin / 60),
    es_festivo: festivo ? 1 : 0,
    total_horas: redondear(totalMin / 60),
  };
}

module.exports = {
  calcularPascua,
  festivosDeAnio,
  esDiaFestivo,
  calcularHoras,
  horaAMinutos,
};
