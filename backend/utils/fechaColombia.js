'use strict';

/**
 * Hora "actual" de Colombia (UTC-5, sin horario de verano) sin depender del
 * timezone del proceso Node ni del `time_zone` de sesión de MySQL — ambos
 * pueden no coincidir con Colombia según el hosting.
 */

const OFFSET_MS = 5 * 3_600_000;

/**
 * Instante en Colombia como literal SQL 'YYYY-MM-DD HH:MM:SS'.
 * @param {number} [extraMs=0] Desplazamiento adicional desde ahora (ej. para límites futuros).
 */
function ahoraColombiaSQL(extraMs = 0) {
  return new Date(Date.now() - OFFSET_MS + extraMs).toISOString().slice(0, 19).replace('T', ' ');
}

module.exports = { ahoraColombiaSQL };
