'use strict';

const WompiService = require('./wompi.service');
const logger = require('../../utils/logger');

const INTERVALO_MS = 5 * 60 * 1000; // cada 5 min

function iniciarWorker() {
  const timer = setInterval(() => {
    WompiService.procesarPendientes().catch(err =>
      logger.error('[wompi-worker]', err.message)
    );
  }, INTERVALO_MS);
  timer.unref();
  logger.info('[wompi-worker] iniciado (reintentos cada 5min)');
  return timer;
}

module.exports = { iniciarWorker };
