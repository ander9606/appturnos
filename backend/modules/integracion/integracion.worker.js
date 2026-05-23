'use strict';

const IntegracionService = require('./integracion.service');
const logger = require('../../utils/logger');

/**
 * Worker que despacha la cola de eventos salientes hacia logiq360.
 * Se ejecuta cada 30 segundos (ver 05-INTEGRACION.md).
 */
const INTERVALO_MS = 30_000;

function iniciarWorker() {
  const timer = setInterval(() => {
    IntegracionService.procesarCola().catch((err) =>
      logger.error('[integracion-worker]', err.message)
    );
  }, INTERVALO_MS);
  timer.unref(); // no impide que el proceso termine si todo lo demás acabó
  logger.info('[integracion-worker] iniciado (cada 30s)');
  return timer;
}

module.exports = { iniciarWorker };
