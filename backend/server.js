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
app.use('/api/trabajadores', require('./modules/trabajadores/trabajadores.routes'));
app.use('/api/turnos', require('./modules/turnos/turnos.routes'));
app.use('/api/nomina', require('./modules/nomina/nomina.routes'));
app.use('/api/contratos', require('./modules/contratos/contratos.routes'));
app.use('/api/notificaciones', require('./modules/notificaciones/notificaciones.routes'));
app.use('/api/push', require('./modules/notificaciones/push/push.routes'));
app.use('/api/integracion', require('./modules/integracion/integracion.routes'));
app.use('/api/reportes', require('./modules/reportes/reportes.routes'));
// Multi-empresa: directorio de empleadores + vínculos trabajador ↔ empresa.
app.use('/api/empresas', require('./modules/empresas/empresas.routes'));
app.use('/api/trabajador-empresa', require('./modules/trabajador-empresa/trabajador-empresa.routes'));
// Catálogo de cargos (sistema + custom por empresa). Ref: 012_cargos.
app.use('/api/cargos', require('./modules/cargos/cargos.routes'));
// Puntos de marcaje GPS por empresa. Ref: 015_puntos_marcaje.
app.use('/api/puntos-marcaje', require('./modules/puntos-marcaje/puntos-marcaje.routes'));
// Panel de super_admin: gestión cross-tenant de empresas y reportes globales.
app.use('/api/admin', require('./modules/admin/admin.routes'));

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

  // Worker que despacha la cola de webhooks salientes hacia logiq360.
  require('./modules/integracion/integracion.worker').iniciarWorker();

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
