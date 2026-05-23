'use strict';

const crypto = require('crypto');

/**
 * Utilidades de firma HMAC-SHA256 para los webhooks de integración.
 */

/** Firma un cuerpo y devuelve la cadena en formato 'sha256=<hex>'. */
function firmar(cuerpo, secreto) {
  const hmac = crypto.createHmac('sha256', secreto).update(cuerpo).digest('hex');
  return `sha256=${hmac}`;
}

/** Compara dos firmas en tiempo constante (evita timing attacks). */
function firmasCoinciden(firmaA, firmaB) {
  const a = Buffer.from(String(firmaA));
  const b = Buffer.from(String(firmaB));
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

module.exports = { firmar, firmasCoinciden };
