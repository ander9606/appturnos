'use strict';

const { validationResult, query } = require('express-validator');
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

/**
 * Regla de express-validator: rechaza si el rango entre dos query params de
 * fecha supera `dias`. Evita reportes/listados sin paginación que agregan
 * sobre rangos arbitrariamente largos (ej. décadas) — protege contra un
 * abuso barato de peticiones caras.
 *
 * Uso: [query('desde').optional().isISO8601(), query('hasta').optional().isISO8601(),
 *       rangoFechasMax(366)]
 */
function rangoFechasMax(dias, campoDesde = 'desde', campoHasta = 'hasta') {
  return query(campoHasta)
    .optional()
    .custom((hasta, { req }) => {
      const desde = req.query[campoDesde];
      if (!desde || !hasta) return true;
      const ms = new Date(hasta) - new Date(desde);
      // Fechas inválidas ya las reporta isISO8601() en su propia regla.
      if (!Number.isNaN(ms) && ms > dias * 24 * 60 * 60 * 1000) {
        throw new Error(`El rango entre ${campoDesde} y ${campoHasta} no puede superar ${dias} días`);
      }
      return true;
    });
}

module.exports = { validar, rangoFechasMax };
