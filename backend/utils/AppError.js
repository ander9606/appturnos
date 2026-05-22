'use strict';

/**
 * Error operacional con código HTTP.
 * Los errores creados con esta clase son "esperados" (validación, permisos,
 * no encontrado, etc.) y el errorHandler los devuelve tal cual al cliente.
 * Cualquier otro error se trata como fallo interno (500).
 */
class AppError extends Error {
  /**
   * @param {string} mensaje  Texto legible para el cliente.
   * @param {number} statusCode  Código HTTP (default 500).
   */
  constructor(mensaje, statusCode = 500) {
    super(mensaje);
    this.statusCode = statusCode;
    this.status = statusCode >= 400 && statusCode < 500 ? 'fail' : 'error';
    this.esOperacional = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = AppError;
