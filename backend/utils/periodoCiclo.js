'use strict';

/**
 * Cálculo de límites de período según un ciclo de liquidación.
 * Puramente calendario — sin conocimiento de nómina, empresa ni timezone.
 * Usado por nómina (períodos) y turnos eventuales, que comparten el mismo
 * concepto de ciclo pero aplican cadencias distintas.
 */

const CICLOS = ['mensual', 'quincenal', 'semanal', 'trimestral'];

/** Returns YYYY-MM-DD for a Date (UTC-safe). */
function toISODate(d) {
  return d.toISOString().slice(0, 10);
}

/** Returns { fecha_inicio, fecha_fin, tipo } for the period that contains today. */
function calcularPeriodoActual(tipo) {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth(); // 0-indexed
  const d = now.getDate();
  let inicio, fin;
  if (tipo === 'mensual') {
    inicio = new Date(y, m, 1);
    fin    = new Date(y, m + 1, 0);
  } else if (tipo === 'quincenal') {
    if (d <= 15) {
      inicio = new Date(y, m, 1);
      fin    = new Date(y, m, 15);
    } else {
      inicio = new Date(y, m, 16);
      fin    = new Date(y, m + 1, 0);
    }
  } else if (tipo === 'trimestral') {
    const q = Math.floor(m / 3); // 0..3
    inicio = new Date(y, q * 3, 1);
    fin    = new Date(y, q * 3 + 3, 0);
  } else {
    // semanal: lunes → domingo
    const dow = now.getDay();
    const lunes = new Date(now);
    lunes.setDate(d - (dow === 0 ? 6 : dow - 1));
    const domingo = new Date(lunes);
    domingo.setDate(lunes.getDate() + 6);
    inicio = lunes;
    fin    = domingo;
  }
  return { fecha_inicio: toISODate(inicio), fecha_fin: toISODate(fin), tipo };
}

/** Returns { fecha_inicio, fecha_fin, tipo } for the period that follows fechaFin. */
function calcularSiguientePeriodo(tipo, fechaFin) {
  const last = new Date(fechaFin + 'T12:00:00Z');
  const nextStart = new Date(last);
  nextStart.setUTCDate(nextStart.getUTCDate() + 1);
  const y = nextStart.getUTCFullYear();
  const m = nextStart.getUTCMonth();
  const d = nextStart.getUTCDate();
  let fin;
  if (tipo === 'mensual') {
    fin = new Date(Date.UTC(y, m + 1, 0));
  } else if (tipo === 'quincenal') {
    fin = d <= 15
      ? new Date(Date.UTC(y, m, 15))
      : new Date(Date.UTC(y, m + 1, 0));
  } else if (tipo === 'trimestral') {
    const q = Math.floor(m / 3);
    fin = new Date(Date.UTC(y, q * 3 + 3, 0));
  } else {
    fin = new Date(nextStart);
    fin.setUTCDate(nextStart.getUTCDate() + 6);
  }
  return { fecha_inicio: toISODate(nextStart), fecha_fin: toISODate(fin), tipo };
}

module.exports = { CICLOS, toISODate, calcularPeriodoActual, calcularSiguientePeriodo };
