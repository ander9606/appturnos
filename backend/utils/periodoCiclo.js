'use strict';

const { ahoraColombiaSQL } = require('./fechaColombia');

/**
 * Cálculo de límites de período según un ciclo de liquidación.
 * Usa hora de Colombia (UTC-5), no UTC.
 * Usado por nómina (períodos) y turnos eventuales, que comparten el mismo
 * concepto de ciclo pero aplican cadencias distintas.
 */

const CICLOS = ['mensual', 'quincenal', 'semanal', 'trimestral'];

/** Formatea números a 2 dígitos para YYYY-MM-DD */
function pad(n) {
  return String(n).padStart(2, '0');
}

/** Returns YYYY-MM-DD para una fecha local (no UTC). Usa solo para display — no guardes. */
function toISODate(d) {
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return `${y}-${pad(m)}-${pad(day)}`;
}

/** Returns { fecha_inicio, fecha_fin, tipo } for the period that contains today. */
function calcularPeriodoActual(tipo) {
  // IMPORTANTE: Usa hora de Colombia (UTC-5), no UTC, para cálculos de período
  const hoyColombia = ahoraColombiaSQL().slice(0, 10); // YYYY-MM-DD
  const [ys, ms, ds] = hoyColombia.split('-');
  const y = Number(ys);
  const m_1based = Number(ms);
  const d = Number(ds);
  let inicio, fin;

  if (tipo === 'mensual') {
    inicio = `${y}-${pad(m_1based)}-01`;
    // Último día del mes — sin new Date() para evitar ambigüedad de timezone
    const dias_en_mes = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    if (m_1based === 2 && (y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0))) {
      dias_en_mes[1] = 29;
    }
    const ultimo_dia = dias_en_mes[m_1based - 1];
    fin = `${y}-${pad(m_1based)}-${pad(ultimo_dia)}`;
  } else if (tipo === 'quincenal') {
    if (d <= 15) {
      inicio = `${y}-${pad(m_1based)}-01`;
      fin = `${y}-${pad(m_1based)}-15`;
    } else {
      inicio = `${y}-${pad(m_1based)}-16`;
      // Último día del mes — calcular sin new Date() para evitar ambigüedad de timezone
      const nextMonth_1based = m_1based === 12 ? 1 : m_1based + 1;
      const nextMonth_year = m_1based === 12 ? y + 1 : y;
      // Primer día del mes siguiente - 1 = último día del mes actual
      // Usar cálculo puro: meses con 31 días son 1,3,5,7,8,10,12; 30 días 4,6,9,11; febrero 28/29
      const dias_en_mes = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
      // Ajustar febrero en años bisiestos
      if (m_1based === 2 && (y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0))) {
        dias_en_mes[1] = 29;
      }
      const ultimo_dia = dias_en_mes[m_1based - 1];
      fin = `${y}-${pad(m_1based)}-${pad(ultimo_dia)}`;
    }
  } else if (tipo === 'trimestral') {
    const q = Math.floor((m_1based - 1) / 3); // 0..3
    const startMonth = q * 3 + 1;
    const endMonth = (q + 1) * 3;
    inicio = `${y}-${pad(startMonth)}-01`;
    // Último día del trimestre — sin new Date() para evitar ambigüedad de timezone
    const dias_en_mes = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    if (endMonth === 2 && (y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0))) {
      dias_en_mes[1] = 29;
    }
    const ultimo_dia = dias_en_mes[endMonth - 1];
    fin = `${y}-${pad(endMonth)}-${pad(ultimo_dia)}`;
  } else {
    // semanal: lunes → domingo (basado en fecha de Colombia)
    const fechaColombia = new Date(y, m_1based - 1, d);
    const dow = fechaColombia.getDay(); // 0=domingo, 1=lunes...6=sábado
    const dayOfWeek = dow === 0 ? 7 : dow; // 1=lunes...7=domingo
    const lunesDate = new Date(y, m_1based - 1, d - dayOfWeek + 1);
    const domingoDate = new Date(y, m_1based - 1, d + (7 - dayOfWeek) + 1);

    inicio = toISODate(lunesDate);
    fin = toISODate(domingoDate);
  }
  return { fecha_inicio: inicio, fecha_fin: fin, tipo };
}

/** Returns { fecha_inicio, fecha_fin, tipo } for the period that follows fechaFin. */
function calcularSiguientePeriodo(tipo, fechaFin) {
  // fechaFin es YYYY-MM-DD. El día siguiente es el inicio del siguiente período.
  const [ys, ms, ds] = fechaFin.split('-');
  const y = Number(ys);
  const m_1based = Number(ms);
  const d = Number(ds);

  // Calcular el día siguiente
  let siguienteDate = new Date(y, m_1based - 1, d);
  siguienteDate.setDate(siguienteDate.getDate() + 1);

  // Extraer año, mes, día del día siguiente
  const siguiente_y = siguienteDate.getFullYear();
  const siguiente_m_1based = siguienteDate.getMonth() + 1;
  const siguiente_d = siguienteDate.getDate();

  let inicio, fin;

  if (tipo === 'mensual') {
    inicio = `${siguiente_y}-${pad(siguiente_m_1based)}-01`;
    // Último día del mes siguiente — sin new Date() para evitar ambigüedad de timezone
    const dias_en_mes = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    if (siguiente_m_1based === 2 && (siguiente_y % 4 === 0 && (siguiente_y % 100 !== 0 || siguiente_y % 400 === 0))) {
      dias_en_mes[1] = 29;
    }
    const ultimo_dia = dias_en_mes[siguiente_m_1based - 1];
    fin = `${siguiente_y}-${pad(siguiente_m_1based)}-${pad(ultimo_dia)}`;
  } else if (tipo === 'quincenal') {
    if (siguiente_d <= 15) {
      inicio = `${siguiente_y}-${pad(siguiente_m_1based)}-01`;
      fin = `${siguiente_y}-${pad(siguiente_m_1based)}-15`;
    } else {
      inicio = `${siguiente_y}-${pad(siguiente_m_1based)}-16`;
      // Último día del mes — sin new Date() para evitar ambigüedad de timezone
      const dias_en_mes = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
      if (siguiente_m_1based === 2 && (siguiente_y % 4 === 0 && (siguiente_y % 100 !== 0 || siguiente_y % 400 === 0))) {
        dias_en_mes[1] = 29;
      }
      const ultimo_dia = dias_en_mes[siguiente_m_1based - 1];
      fin = `${siguiente_y}-${pad(siguiente_m_1based)}-${pad(ultimo_dia)}`;
    }
  } else if (tipo === 'trimestral') {
    const q = Math.floor((siguiente_m_1based - 1) / 3);
    const startMonth = q * 3 + 1;
    const endMonth = (q + 1) * 3;
    inicio = `${siguiente_y}-${pad(startMonth)}-01`;
    // Último día del trimestre — sin new Date() para evitar ambigüedad de timezone
    const dias_en_mes = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    if (endMonth === 2 && (siguiente_y % 4 === 0 && (siguiente_y % 100 !== 0 || siguiente_y % 400 === 0))) {
      dias_en_mes[1] = 29;
    }
    const ultimo_dia = dias_en_mes[endMonth - 1];
    fin = `${siguiente_y}-${pad(endMonth)}-${pad(ultimo_dia)}`;
  } else {
    // semanal
    const fechaColombia = new Date(siguiente_y, siguiente_m_1based - 1, siguiente_d);
    const dow = fechaColombia.getDay();
    const dayOfWeek = dow === 0 ? 7 : dow;
    const lunesDate = new Date(siguiente_y, siguiente_m_1based - 1, siguiente_d - dayOfWeek + 1);
    const domingoDate = new Date(siguiente_y, siguiente_m_1based - 1, siguiente_d + (7 - dayOfWeek) + 1);

    inicio = toISODate(lunesDate);
    fin = toISODate(domingoDate);
  }

  return { fecha_inicio: inicio, fecha_fin: fin, tipo };
}

module.exports = { CICLOS, toISODate, calcularPeriodoActual, calcularSiguientePeriodo };
