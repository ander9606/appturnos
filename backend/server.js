'use strict';

require('dotenv').config();

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');

const logger = require('./utils/logger');
const { verificarConexion } = require('./config/database');
const { errorHandler, noEncontrado } = require('./middleware/errorHandler');

const app = express();
const PORT = Number(process.env.PORT) || 3001;

// ─── Middleware base ──────────────────────────────────────────
app.use(helmet());
app.use(cors());

// Captura el body crudo: necesario para verificar la firma HMAC de los
// webhooks entrantes de logiq360 (ver 05-INTEGRACION.md).
app.use(
  express.json({
    limit: '1mb',
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  })
);
app.use(express.urlencoded({ extended: true }));

// ─── Health check ─────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({
    success: true,
    data: { status: 'ok', uptime: process.uptime() },
    message: 'App Turnos API operativa',
  });
});

// ─── Rutas de módulos ─────────────────────────────────────────
app.use('/api/auth', require('./modules/auth/auth.routes'));

// Se montan aquí a medida que se implementan los módulos:
//   app.use('/api/trabajadores', require('./modules/trabajadores/trabajadores.routes'));
//   app.use('/api/nomina', require('./modules/nomina/nomina.routes'));
//   app.use('/api/turnos', require('./modules/turnos/turnos.routes'));
//   app.use('/api/contratos', require('./modules/contratos/contratos.routes'));
//   app.use('/api/integracion', require('./modules/integracion/integracion.routes'));
//   app.use('/api/reportes', require('./modules/reportes/reportes.routes'));

// ─── Manejo de errores ────────────────────────────────────────
app.use(noEncontrado);
app.use(errorHandler);

// ─── Arranque ─────────────────────────────────────────────────
async function iniciar() {
  try {
    await verificarConexion();
  } catch (err) {
    logger.error('No se pudo conectar a la base de datos:', err.message);
    process.exit(1);
  }

  const servidor = app.listen(PORT, () => {
    logger.info(`App Turnos API escuchando en el puerto ${PORT}`);
  });

  const apagar = (senal) => {
    logger.info(`${senal} recibido, cerrando servidor...`);
    servidor.close(() => process.exit(0));
  };
  process.on('SIGTERM', () => apagar('SIGTERM'));
  process.on('SIGINT', () => apagar('SIGINT'));
}

// Solo arranca si se ejecuta directamente (permite importar `app` en tests).
if (require.main === module) {
  iniciar();
}

module.exports = app;
