'use strict';

// Debe importarse antes que cualquier otro módulo (server.js lo hace primero)
// para que Sentry pueda instrumentar express/http automáticamente.
require('dotenv').config();

const Sentry = require('@sentry/node');
const logger = require('./utils/logger');

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: 0, // ponytail: solo error monitoring, sin tracing/profiling — subir si hace falta
  });
}

// Errores fuera del ciclo request/response de Express (workers, timers) no
// pasan por errorHandler.js — sin esto, no se loguean ni se reportan a Sentry.
process.on('unhandledRejection', (razon) => {
  logger.error('unhandledRejection:', razon);
  Sentry.captureException(razon);
});

process.on('uncaughtException', (err) => {
  logger.error('uncaughtException:', err);
  Sentry.captureException(err);
  Sentry.flush(2000).finally(() => process.exit(1));
});

module.exports = Sentry;
