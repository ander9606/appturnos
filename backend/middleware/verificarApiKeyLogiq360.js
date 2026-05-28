'use strict';

const pool = require('../config/database');
const AppError = require('../utils/AppError');

/**
 * Middleware para endpoints que logiq360 consulta vía pull (GET).
 * logiq360 presenta `X-API-Key: <valor>` que debe coincidir con
 * `integracion_config.incoming_secret` de alguna empresa activa.
 *
 * Si la clave es válida, inyecta `req.empresa_id` igual que el JWT middleware,
 * permitiendo reutilizar los mismos servicios downstream.
 *
 * Ref: docs/INTEGRACION-LOGIQ360-APP-TURNOS.md — sección "Autenticación entre sistemas"
 */
async function verificarApiKeyLogiq360(req, res, next) {
  const apiKey = req.headers['x-api-key'];
  if (!apiKey) {
    return next(new AppError('X-API-Key requerido', 401));
  }

  const [rows] = await pool.query(
    `SELECT empresa_id
       FROM integracion_config
      WHERE incoming_secret = ?
        AND activo = 1
      LIMIT 1`,
    [apiKey]
  );

  if (!rows.length) {
    return next(new AppError('API key inválida o integración inactiva', 401));
  }

  req.empresa_id = rows[0].empresa_id;
  next();
}

module.exports = { verificarApiKeyLogiq360 };
