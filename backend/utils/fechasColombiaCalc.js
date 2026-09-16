'use strict';

const { ahoraColombiaSQL } = require('./fechaColombia');

/**
 * Utilidad centralizada para cálculos de fecha en Colombia (UTC-5).
 * Todas las funciones trabajan con strings YYYY-MM-DD para evitar ambigüedad de timezone.
 *
 * Uso:
 *   const { FechasColombiaCalc } = require('./fechasColombiaCalc');
 *   const hoy = FechasColombiaCalc.obtenerHoyEnColombia();
 */

/** Formatea número a 2 dígitos */
function pad(n) {
  return String(n).padStart(2, '0');
}

/** Extrae componentes de string YYYY-MM-DD */
function parseISO(dateStr) {
  const [y, m, d] = dateStr.split('-');
  return { y: Number(y), m: Number(m), d: Number(d) };
}

/** Verifica si un año es bisiesto */
function esAñoBisiesto(año) {
  return año % 4 === 0 && (año % 100 !== 0 || año % 400 === 0);
}

/** Devuelve la cantidad de días en un mes específico */
function diasEnMes(año, mes) {
  const dias = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (mes === 2 && esAñoBisiesto(año)) {
    return 29;
  }
  return dias[mes - 1];
}

/** Obtiene la hora actual en Colombia como string YYYY-MM-DD */
function obtenerHoyEnColombia() {
  return ahoraColombiaSQL().slice(0, 10);
}

/**
 * Devuelve el último día del mes como string YYYY-MM-DD
 * Ejemplo: obtenerUltimoDiaMes(2026, 9) => "2026-09-30"
 */
function obtenerUltimoDiaMes(año, mes) {
  const ultimoDia = diasEnMes(año, mes);
  return `${año}-${pad(mes)}-${pad(ultimoDia)}`;
}

/**
 * Suma días a una fecha (string YYYY-MM-DD)
 * Ejemplo: agregarDias("2026-09-28", 5) => "2026-10-03"
 */
function agregarDias(dateStr, diasAAgregar) {
  const { y, m, d } = parseISO(dateStr);
  const date = new Date(y, m - 1, d + diasAAgregar);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * Resta días a una fecha (string YYYY-MM-DD)
 * Ejemplo: restarDias("2026-10-03", 5) => "2026-09-28"
 */
function restarDias(dateStr, diasARestar) {
  return agregarDias(dateStr, -diasARestar);
}

/**
 * Calcula la diferencia en días entre dos fechas (string YYYY-MM-DD)
 * Ejemplo: diferenciaEnDias("2026-09-30", "2026-09-16") => 14
 */
function diferenciaEnDias(fecha1, fecha2) {
  const { y: y1, m: m1, d: d1 } = parseISO(fecha1);
  const { y: y2, m: m2, d: d2 } = parseISO(fecha2);
  const date1 = new Date(y1, m1 - 1, d1);
  const date2 = new Date(y2, m2 - 1, d2);
  const diffMS = date1 - date2;
  return Math.floor(diffMS / (1000 * 60 * 60 * 24));
}

/**
 * Calcula el período (inicio, fin) que contiene una fecha dada
 * Retorna { fecha_inicio, fecha_fin, tipo }
 *
 * Ejemplos:
 *   calcularPeriodo('mensual', '2026-09-16') => { fecha_inicio: '2026-09-01', fecha_fin: '2026-09-30', tipo: 'mensual' }
 *   calcularPeriodo('quincenal', '2026-09-16') => { fecha_inicio: '2026-09-16', fecha_fin: '2026-09-30', tipo: 'quincenal' }
 */
function calcularPeriodo(tipo, dateStr = null) {
  const hoyStr = dateStr || obtenerHoyEnColombia();
  const { y, m, d } = parseISO(hoyStr);

  if (tipo === 'mensual') {
    const inicio = `${y}-${pad(m)}-01`;
    const fin = obtenerUltimoDiaMes(y, m);
    return { fecha_inicio: inicio, fecha_fin: fin, tipo };
  }

  if (tipo === 'quincenal') {
    if (d <= 15) {
      const inicio = `${y}-${pad(m)}-01`;
      const fin = `${y}-${pad(m)}-15`;
      return { fecha_inicio: inicio, fecha_fin: fin, tipo };
    } else {
      const inicio = `${y}-${pad(m)}-16`;
      const fin = obtenerUltimoDiaMes(y, m);
      return { fecha_inicio: inicio, fecha_fin: fin, tipo };
    }
  }

  if (tipo === 'trimestral') {
    const q = Math.floor((m - 1) / 3);
    const mesInicio = q * 3 + 1;
    const mesFin = (q + 1) * 3;
    const inicio = `${y}-${pad(mesInicio)}-01`;
    const fin = obtenerUltimoDiaMes(y, mesFin);
    return { fecha_inicio: inicio, fecha_fin: fin, tipo };
  }

  if (tipo === 'semanal') {
    // Semana: lunes a domingo (lunes = 1, domingo = 7)
    const fechaDate = new Date(y, m - 1, d);
    const dow = fechaDate.getDay(); // 0 = domingo, 1 = lunes, ..., 6 = sábado
    const dayOfWeek = dow === 0 ? 7 : dow; // Convertir a: 1 = lunes, ..., 7 = domingo

    const lunesDate = new Date(y, m - 1, d - dayOfWeek + 1);
    const domingoDate = new Date(y, m - 1, d + (7 - dayOfWeek) + 1);

    const inicio = `${lunesDate.getFullYear()}-${pad(lunesDate.getMonth() + 1)}-${pad(lunesDate.getDate())}`;
    const fin = `${domingoDate.getFullYear()}-${pad(domingoDate.getMonth() + 1)}-${pad(domingoDate.getDate())}`;
    return { fecha_inicio: inicio, fecha_fin: fin, tipo };
  }

  throw new Error(`Tipo de período inválido: ${tipo}`);
}

/**
 * Calcula el período que sigue después de una fecha fin
 * El día siguiente a fecha_fin es el inicio del nuevo período
 * Retorna { fecha_inicio, fecha_fin, tipo }
 */
function calcularSiguientePeriodo(tipo, fechaFin) {
  const siguienteDay = agregarDias(fechaFin, 1);
  return calcularPeriodo(tipo, siguienteDay);
}

/**
 * Valida que una fecha esté en formato correcto (YYYY-MM-DD)
 * y que sea una fecha válida
 */
function validarFecha(dateStr) {
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(dateStr)) {
    throw new Error(`Formato de fecha inválido: ${dateStr}. Esperado: YYYY-MM-DD`);
  }

  const { y, m, d } = parseISO(dateStr);

  if (m < 1 || m > 12) {
    throw new Error(`Mes inválido: ${m}`);
  }

  const maxDia = diasEnMes(y, m);
  if (d < 1 || d > maxDia) {
    throw new Error(`Día inválido para ${y}-${pad(m)}: ${d}`);
  }

  return true;
}

/**
 * Valida que un período tenga fechas válidas y coherentes
 */
function validarPeriodo(periodo) {
  validarFecha(periodo.fecha_inicio);
  validarFecha(periodo.fecha_fin);

  if (periodo.fecha_fin < periodo.fecha_inicio) {
    throw new Error(
      `Período inválido: fecha_fin (${periodo.fecha_fin}) es anterior a fecha_inicio (${periodo.fecha_inicio})`
    );
  }

  return true;
}

/**
 * Verifica si una fecha cae dentro de un período
 */
function estaDentroDelPeriodo(fecha, periodo) {
  return fecha >= periodo.fecha_inicio && fecha <= periodo.fecha_fin;
}

// Exportar como módulo singleton
module.exports = {
  // Utilidades básicas
  esAñoBisiesto,
  diasEnMes,
  pad,
  parseISO,

  // Operaciones de fecha
  obtenerHoyEnColombia,
  obtenerUltimoDiaMes,
  agregarDias,
  restarDias,
  diferenciaEnDias,

  // Cálculos de período
  calcularPeriodo,
  calcularSiguientePeriodo,

  // Validación
  validarFecha,
  validarPeriodo,
  estaDentroDelPeriodo,
};
