'use strict';

const express          = require('express');
const { verificarToken, verificarRol } = require('../../../middleware/authMiddleware');
const { ROLES }        = require('../../../config/constants');
const { body, param, query } = require('express-validator');
const { validarCampos } = require('../../../middleware/validator');
const ctrl             = require('./compensatorios.controller');

const router = express.Router();
router.use(verificarToken);

const ROLES_GESTOR = [ROLES.ADMIN_EMPRESA, ROLES.JEFE_NOMINA];

// GET /api/nomina/compensatorios?estado=pendiente
router.get(
  '/',
  verificarRol([...ROLES_GESTOR, ROLES.TRABAJADOR_NOMINA]),
  query('estado').optional().isIn(['pendiente', 'asignado', 'tomado']),
  validarCampos,
  ctrl.listar
);

// PUT /api/nomina/compensatorios/:id/asignar
router.put(
  '/:id/asignar',
  verificarRol(ROLES_GESTOR),
  param('id').isInt({ min: 1 }),
  body('fechaAsignada').isDate().withMessage('fechaAsignada debe ser YYYY-MM-DD'),
  validarCampos,
  ctrl.asignar
);

module.exports = router;
