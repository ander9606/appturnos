'use strict';

const express = require('express');
const { param, body } = require('express-validator');

const { validar } = require('../../middleware/validator');
const { verificarToken, verificarRol } = require('../../middleware/authMiddleware');
const { ROLES } = require('../../config/constants');
const ctrl = require('./novedades.controller');

const router = express.Router({ mergeParams: true });

const PERMITIDOS = [
  ROLES.ADMIN_EMPRESA, ROLES.JEFE_TURNOS, ROLES.JEFE_NOMINA, ROLES.TRABAJADOR_TURNOS,
];

const idParam = param('asignacionId').isInt({ min: 1 }).withMessage('asignacionId inválido');

router.use(verificarToken, verificarRol(PERMITIDOS));

// GET /api/novedades/asignaciones/:asignacionId
router.get('/:asignacionId', [idParam], validar, ctrl.listar);

// POST /api/novedades/asignaciones/:asignacionId
router.post(
  '/:asignacionId',
  [
    idParam,
    body('tipo')
      .isIn(['retraso', 'ausencia', 'incidente', 'otro'])
      .withMessage('tipo inválido'),
    body('descripcion')
      .isString()
      .trim()
      .isLength({ min: 1, max: 1000 })
      .withMessage('descripcion requerida (máx 1000 caracteres)'),
    body('hora_evento')
      .optional({ values: 'falsy' })
      .isISO8601()
      .withMessage('hora_evento debe ser ISO 8601'),
    body('foto_b64')
      .optional({ values: 'falsy' })
      .isString()
      .withMessage('foto_b64 debe ser string base64'),
    body('latitud')
      .optional({ values: 'falsy' })
      .isFloat({ min: -90, max: 90 })
      .withMessage('latitud inválida'),
    body('longitud')
      .optional({ values: 'falsy' })
      .isFloat({ min: -180, max: 180 })
      .withMessage('longitud inválida'),
  ],
  validar,
  ctrl.crear
);

module.exports = router;
