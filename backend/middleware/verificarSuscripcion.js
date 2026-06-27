'use strict';

const { pool } = require('../config/database');
const AppError = require('../utils/AppError');

/**
 * Middleware de suscripción. Aplica solo a rutas de escritura en endpoints protegidos.
 * NULL en suscripcion_vigente_hasta = acceso indefinido (logiq360 o admin manual).
 * Retorna 402 si la suscripción venció.
 */
async function verificarSuscripcion(req, _res, next) {
  try {
    const [[empresa]] = await pool.query(
      'SELECT suscripcion_vigente_hasta FROM empresas WHERE id = ? AND activo = 1 LIMIT 1',
      [req.usuario.empresa_id]
    );
    if (!empresa) return next(new AppError('Empresa no encontrada', 404));
    if (empresa.suscripcion_vigente_hasta === null) return next();
    // 3 días de gracia después del vencimiento
    const limite = new Date(empresa.suscripcion_vigente_hasta);
    limite.setDate(limite.getDate() + 3);
    if (limite >= new Date()) return next();
    return next(new AppError('Suscripción vencida. Renueva tu plan para continuar.', 402));
  } catch (err) {
    return next(err);
  }
}

module.exports = verificarSuscripcion;
