'use strict';

const AppError = require('../utils/AppError');
const { firmar, firmasCoinciden } = require('../utils/hmac');

/**
 * Verifica la firma HMAC-SHA256 de un webhook entrante de logiq360.
 *
 * Usa el secreto global `LOGIQ360_WEBHOOK_SECRET`. Si no está configurado,
 * no se verifica nada: la integración es opcional (ver 05-INTEGRACION.md).
 *
 * Requiere que `req.rawBody` esté disponible (lo captura server.js).
 */
function verificarFirmaLogiq360(req, _res, next) {
  const secreto = process.env.LOGIQ360_WEBHOOK_SECRET;
  if (!secreto) return next();

  const recibida = req.headers['x-logiq360-signature'] || '';
  const esperada = firmar(req.rawBody || Buffer.alloc(0), secreto);

  if (!firmasCoinciden(recibida, esperada)) {
    return next(new AppError('Firma del webhook inválida', 401));
  }
  next();
}

module.exports = { verificarFirmaLogiq360 };
