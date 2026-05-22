'use strict';

const AppError = require('../utils/AppError');
const logger = require('../utils/logger');

/**
 * Mapea errores conocidos de MySQL a respuestas legibles.
 * @returns {AppError|null}
 */
function traducirErrorMySQL(err) {
  switch (err.code) {
    case 'ER_DUP_ENTRY':
      return new AppError('Ya existe un registro con esos datos', 409);
    case 'ER_NO_REFERENCED_ROW_2':
    case 'ER_NO_REFERENCED_ROW':
      return new AppError('Referencia a un registro inexistente', 400);
    case 'ER_ROW_IS_REFERENCED_2':
    case 'ER_ROW_IS_REFERENCED':
      return new AppError('No se puede eliminar: tiene registros asociados', 409);
    default:
      return null;
  }
}

/**
 * Manejador de errores central. Debe registrarse al final de la cadena
 * de middleware en server.js (después de las rutas).
 */
// eslint-disable-next-line no-unused-vars -- Express identifica el handler por su aridad (4 args).
function errorHandler(err, req, res, _next) {
  let error = err;

  if (!(error instanceof AppError)) {
    const mysqlErr = error?.code ? traducirErrorMySQL(error) : null;
    error = mysqlErr || error;
  }

  const esOperacional = error instanceof AppError;
  const statusCode = esOperacional ? error.statusCode : 500;

  if (!esOperacional) {
    logger.error(`${req.method} ${req.originalUrl}`, err.stack || err.message);
  }

  const cuerpo = {
    success: false,
    status: esOperacional ? error.status : 'error',
    message: esOperacional ? error.message : 'Error interno del servidor',
  };

  if (esOperacional && Array.isArray(error.detalles)) {
    cuerpo.detalles = error.detalles;
  }

  if (process.env.NODE_ENV !== 'production' && !esOperacional) {
    cuerpo.stack = err.stack;
  }

  res.status(statusCode).json(cuerpo);
}

/** Handler 404 para rutas no registradas. */
function noEncontrado(req, _res, next) {
  next(new AppError(`Ruta no encontrada: ${req.method} ${req.originalUrl}`, 404));
}

module.exports = { errorHandler, noEncontrado };
