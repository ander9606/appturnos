'use strict';

const RegistrosModel = require('./registros.model');
const TrabajadoresModel = require('../../trabajadores/trabajadores.model');
const { esDomingo, esDiaFestivo, esDomingoHabitual, ventanaRachaDomingos } = require('../../../utils/laboralUtils');
const { ahoraColombiaSQL } = require('../../../utils/fechaColombia');
const AppError = require('../../../utils/AppError');

// Piezas compartidas por registros.gestion / registros.marcaje / registros.reingreso.

/**
 * Clasifica un domingo O festivo entre semana trabajado como ocasional (solo
 * compensatorio, sin recargo) o habitual (recargo + compensatorio).
 *
 * Decisión de producto: domingo y festivo entre semana cuentan PARA EL MISMO
 * umbral — si el trabajador ya trabajó 2 domingos este mes, el siguiente
 * festivo entre semana ya es el 3º día festivo/domingo del mes y lleva
 * recargo, aunque sea el primer festivo propiamente dicho. El CST solo
 * nombra esta distinción para domingos (Art. 180/181), pero aquí se extiende
 * a festivos por decisión explícita de negocio, no por lectura literal de la
 * ley — ver docs/REGLAS-CALCULO-PAGOS.md.
 *
 * Regla 'dos_meses' es la excepción: solo mira una racha de domingos
 * consecutivos (ventanaRachaDomingos no tiene definición para festivos
 * sueltos entre semana), así que un festivo bajo esa regla sigue siendo
 * siempre 'habitual', igual que antes de este cambio.
 */
async function clasificarDiaFestivo(empresaId, trabajadorId, fecha, regla) {
  const domingo = esDomingo(fecha);
  const esFestivoCalendario = esDiaFestivo(fecha); // domingo o festivo — ya incluye el domingo
  if (!esFestivoCalendario) return { domingo, clasificacion: 'habitual', recargoFestivo: true, numeroDiaFestivo: null };

  if (regla === 'dos_meses') {
    if (!domingo) return { domingo, clasificacion: 'habitual', recargoFestivo: true, numeroDiaFestivo: null };
    const { desde, hasta } = ventanaRachaDomingos(fecha);
    const domingosTrabajadosEnVentana = await RegistrosModel.contarDomingosTrabajadosEntre(empresaId, trabajadorId, desde, hasta);
    const habitual = esDomingoHabitual({ fecha, regla, domingosTrabajadosEnVentana });
    return { domingo, clasificacion: habitual ? 'habitual' : 'ocasional', recargoFestivo: habitual, numeroDiaFestivo: null };
  }

  const numeroDiaFestivo = await RegistrosModel.contarFestivosTrabajadosEnMes(empresaId, trabajadorId, fecha) + 1;
  const habitual = esDomingoHabitual({ fecha, regla, numeroDomingo: numeroDiaFestivo });
  return { domingo, clasificacion: habitual ? 'habitual' : 'ocasional', recargoFestivo: habitual, numeroDiaFestivo };
}

/**
 * El trabajador_nomina solo opera sobre sus propios registros: se resuelve
 * su trabajador y se ignora cualquier trabajador_id que venga en la petición.
 */
async function resolverTrabajadorPropio(empresaId, usuarioId) {
  const trabajador = await TrabajadoresModel.obtenerPorUsuarioId(empresaId, usuarioId);
  if (!trabajador) {
    throw new AppError('Tu usuario no está vinculado a un trabajador activo', 403);
  }
  return trabajador.id;
}

/** ISO date of the Monday of the week containing isoDate. */
function getLunesDeSemana(isoDate) {
  const d = new Date(isoDate + 'T12:00:00Z');
  const dow = d.getUTCDay(); // 0=dom…6=sab
  d.setUTCDate(d.getUTCDate() + (dow === 0 ? -6 : 1 - dow));
  return d.toISOString().slice(0, 10);
}

/** Returns today's date as 'YYYY-MM-DD' in Colombia time (UTC-5, no DST). */
function hoyISO() {
  return ahoraColombiaSQL().slice(0, 10);
}

/** Returns current time as 'HH:MM:SS' in Colombia time (UTC-5), independiente del TZ del proceso. */
function ahoraHHMMSS() {
  return ahoraColombiaSQL().slice(11, 19);
}

module.exports = { clasificarDiaFestivo, resolverTrabajadorPropio, getLunesDeSemana, hoyISO, ahoraHHMMSS };
