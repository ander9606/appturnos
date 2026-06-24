'use strict';

require('dotenv').config();

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const logger = require('./utils/logger');
const { pool, verificarConexion } = require('./config/database');
const { errorHandler, noEncontrado } = require('./middleware/errorHandler');

const app = express();
const PORT = Number(process.env.PORT) || 3001;

// Confiar en el primer proxy (Caddy) para X-Forwarded-For y rate limiting correcto
app.set('trust proxy', 1);

// ─── Middleware base ──────────────────────────────────────────
app.use(helmet());

// CORS: en producción solo los orígenes explícitos de CORS_ORIGINS (CSV).
// En desarrollo acepta cualquier origen para facilitar pruebas locales.
const corsOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean)
  : [];
if (corsOrigins.length === 0 && process.env.NODE_ENV === 'production') {
  logger.error('CORS_ORIGINS no configurado en producción — todos los orígenes permitidos. Configura esta variable.');
}
app.use(cors(corsOrigins.length ? { origin: corsOrigins, credentials: true } : {}));

// ─── Rate limiting ────────────────────────────────────────────
// Límite general: 200 req / 15 min por IP (protege todos los endpoints).
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Demasiadas solicitudes, intenta más tarde' },
}));

// Límite estricto en auth: 10 intentos / 15 min (brute-force protection).
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Demasiados intentos, espera 15 minutos' },
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/refresh', authLimiter);

// Límite por IP+ruta en endpoints de marcaje y postulación: 10 req / min.
// Previene doble-marcaje por spam y abuso de postulaciones masivas.
const marcajeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Demasiadas solicitudes, intenta en un momento' },
});
app.use('/api/turnos/asignaciones/:id/ingreso', marcajeLimiter);
app.use('/api/turnos/asignaciones/:id/egreso', marcajeLimiter);
app.use('/api/turnos/ofertas/:id/aplicar', marcajeLimiter);

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
app.get('/api/health', async (_req, res) => {
  let dbStatus = 'ok';
  try {
    const conn = await pool.getConnection();
    await conn.ping();
    conn.release();
  } catch {
    dbStatus = 'error';
  }
  const status = dbStatus === 'ok' ? 'ok' : 'degraded';
  res.status(dbStatus === 'ok' ? 200 : 503).json({
    success: dbStatus === 'ok',
    data: { status, uptime: process.uptime(), db: dbStatus },
    message: 'App Turnos API ' + status,
  });
});

// ─── Rutas de módulos ─────────────────────────────────────────
app.use('/api/auth', require('./modules/auth/auth.routes'));
app.use('/api/trabajadores', require('./modules/trabajadores/trabajadores.routes'));
app.use('/api/turnos', require('./modules/turnos/turnos.routes'));
app.use('/api/turnos/eventual', require('./modules/turnos-eventual/turnos-eventual.routes'));
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
// Novedades de turno: reportes de retraso, ausencia, incidente u otro por asignación.
app.use('/api/novedades/asignaciones', require('./modules/novedades/novedades.routes'));

// ─── Manejo de errores ────────────────────────────────────────
app.use(noEncontrado);
app.use(errorHandler);

// ─── Arranque ─────────────────────────────────────────────────
async function iniciar() {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'cambiar-por-un-secreto-largo-y-aleatorio') {
    logger.error('JWT_SECRET no configurado o usa el valor por defecto. Configura un secreto seguro antes de iniciar.');
    process.exit(1);
  }

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
