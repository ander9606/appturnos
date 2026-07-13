'use strict';

const IntegracionService = require('./integracion.service');
const ReconciliacionService = require('./services/reconciliacion.service');
const logger = require('../../utils/logger');

/**
 * Worker que despacha la cola de eventos salientes hacia logiq360.
 * Se ejecuta cada 30 segundos (ver 05-INTEGRACION.md).
 */
const INTERVALO_MS = 30_000;

// Reconciliación diaria: corrige integracion_config.activo si un webhook
// integracion.activada/desactivada se perdió tras agotar sus reintentos
// (ver docs/INTEGRACION-LOGIQ360-APP-TURNOS.md v1.2).
const INTERVALO_RECONCILIACION_MS = 24 * 60 * 60 * 1000;

function iniciarWorker() {
  const timer = setInterval(() => {
    IntegracionService.procesarCola().catch((err) =>
      logger.error('[integracion-worker]', err.message)
    );
  }, INTERVALO_MS);
  timer.unref(); // no impide que el proceso termine si todo lo demás acabó

  const timerReconciliacion = setInterval(() => {
    ReconciliacionService.reconciliarTodas().catch((err) =>
      logger.error('[reconciliacion-worker]', err.message)
    );
  }, INTERVALO_RECONCILIACION_MS);
  timerReconciliacion.unref();

  logger.info('[integracion-worker] iniciado (cola cada 30s, reconciliación cada 24h)');
  return timer;
}

module.exports = { iniciarWorker };
