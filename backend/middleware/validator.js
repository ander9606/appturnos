'use strict';

const { validationResult } = require('express-validator');
const AppError = require('../utils/AppError');

/**
 * Middleware que recoge los errores acumulados por las cadenas de
 * express-validator y, si hay alguno, corta la petición con 422.
 *
 * Uso:
 *   const { body } = require('express-validator');
 *   router.post('/login',
 *     [ body('email').isEmail(), body('password').notEmpty() ],
 *     validar,
 *     loginController
 *   );
 */
function validar(req, _res, next) {
  const resultado = validationResult(req);
  if (resultado.isEmpty()) return next();

  const detalles = resultado.array().map((e) => ({
    campo: e.path,
    mensaje: e.msg,
  }));

  const error = new AppError('Datos de entrada inválidos', 422);
  error.detalles = detalles;
  next(error);
}

module.exports = { validar };
