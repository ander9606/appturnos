'use strict';

/**
 * Logger minimalista con niveles y timestamp ISO.
 * Sin dependencias externas; suficiente para v1. En producción puede
 * sustituirse por pino/winston sin cambiar los call sites.
 */

const NIVELES = { error: 0, warn: 1, info: 2, debug: 3 };

const nivelActual =
  NIVELES[process.env.LOG_LEVEL] ??
  (process.env.NODE_ENV === 'production' ? NIVELES.info : NIVELES.debug);

function formatear(nivel, args) {
  const ts = new Date().toISOString();
  return [`[${ts}] [${nivel.toUpperCase()}]`, ...args];
}

function log(nivel, args) {
  if (NIVELES[nivel] > nivelActual) return;
  const salida = nivel === 'error' || nivel === 'warn' ? console.error : console.log;
  salida(...formatear(nivel, args));
}

module.exports = {
  error: (...args) => log('error', args),
  warn: (...args) => log('warn', args),
  info: (...args) => log('info', args),
  debug: (...args) => log('debug', args),
};
