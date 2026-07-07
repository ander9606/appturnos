'use strict';

// Debe importarse antes que cualquier otro módulo (server.js lo hace primero)
// para que Sentry pueda instrumentar express/http automáticamente.
require('dotenv').config();

const Sentry = require('@sentry/node');

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: 0, // ponytail: solo error monitoring, sin tracing/profiling — subir si hace falta
  });
}

module.exports = Sentry;
