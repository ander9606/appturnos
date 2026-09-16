'use strict';

const { pad } = require('./fechasColombiaCalc');
const FechasColombiaCalc = require('./fechasColombiaCalc');

/**
 * Cálculo de límites de período según un ciclo de liquidación.
 * Usa hora de Colombia (UTC-5), no UTC.
 *
 * NOTA: Delegado a FechasColombiaCalc para evitar duplicación de lógica.
 * Este módulo es una interfaz para compatibilidad con código existente.
 * Usado por nómina (períodos) y turnos eventuales.
 */

const CICLOS = ['mensual', 'quincenal', 'semanal', 'trimestral'];

/**
 * Compatibilidad: convierte Date object a string YYYY-MM-DD
 * @deprecated Usar FechasColombiaCalc.parseISO() en su lugar
 */
function toISODate(d) {
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return `${y}-${pad(m)}-${pad(day)}`;
}

/**
 * Calcula el período que contiene hoy (en Colombia)
 * Delega a FechasColombiaCalc.calcularPeriodo()
 */
function calcularPeriodoActual(tipo) {
  return FechasColombiaCalc.calcularPeriodo(tipo);
}

/**
 * Calcula el período siguiente a una fecha fin
 * Delega a FechasColombiaCalc.calcularSiguientePeriodo()
 */
function calcularSiguientePeriodo(tipo, fechaFin) {
  return FechasColombiaCalc.calcularSiguientePeriodo(tipo, fechaFin);
}

module.exports = { CICLOS, toISODate, calcularPeriodoActual, calcularSiguientePeriodo };
