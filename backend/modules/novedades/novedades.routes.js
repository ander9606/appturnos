'use strict';

const express = require('express');
const { param, body } = require('express-validator');

const { validar } = require('../../middleware/validator');
const { verificarToken, verificarRol } = require('../../middleware/authMiddleware');
const { ROLES } = require('../../config/constants');
const ctrl = require('./novedades.controller');

const router = express.Router({ mergeParams: true });

const PERMITIDOS = [
  ROLES.ADMIN_EMPRESA, ROLES.JEFE_TURNOS, ROLES.TRABAJADOR_TURNOS,
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
  ],
  validar,
  ctrl.crear
);

module.exports = router;
