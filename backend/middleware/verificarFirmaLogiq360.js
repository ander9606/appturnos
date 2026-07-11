'use strict';

const { pool } = require('../config/database');
const AppError = require('../utils/AppError');
const { firmar, firmasCoinciden } = require('../utils/hmac');

/**
 * Verifica la firma HMAC-SHA256 de un webhook entrante de logiq360.
 *
 * Prioridad del secreto:
 *  1. integracion_config.incoming_secret del tenant (per-tenant, recomendado).
 *  2. Variable de entorno LOGIQ360_WEBHOOK_SECRET (global, retrocompatible).
 *  3. Sin secreto → sin verificación (integración opcional).
 *
 * El tenant_id se lee del body JSON ya parseado (express.json corre antes).
 * Requiere que req.rawBody esté disponible (lo captura server.js).
 */
async function verificarFirmaLogiq360(req, _res, next) {
  let secreto = null;

  const tenantId = req.body?.tenant_id;
  if (tenantId) {
    // Resolver por el mapeo del pairing; fallback a empresa_id == tenant_id (legacy).
    // No filtra por activo: el secreto debe seguir siendo válido con la integración
    // pausada, para poder verificar el propio evento integracion.activada que la reactiva.
    const [rows] = await pool.query(
      `SELECT incoming_secret FROM integracion_config
       WHERE (logiq360_tenant_id = ? OR empresa_id = ?)
       ORDER BY (logiq360_tenant_id = ?) DESC LIMIT 1`,
      [tenantId, tenantId, tenantId]
    );
    if (rows.length && rows[0].incoming_secret) {
      secreto = rows[0].incoming_secret;
    }
  }

  if (!secreto) {
    secreto = process.env.LOGIQ360_WEBHOOK_SECRET || null;
  }

  if (!secreto) return next();

  const recibida = req.headers['x-logiq360-signature'] || '';
  const esperada = firmar(req.rawBody || Buffer.alloc(0), secreto);

  if (!firmasCoinciden(recibida, esperada)) {
    return next(new AppError('Firma del webhook inválida', 401));
  }
  next();
}

module.exports = { verificarFirmaLogiq360 };
