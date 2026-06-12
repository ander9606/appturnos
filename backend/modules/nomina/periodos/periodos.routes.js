'use strict';

const express = require('express');
const { body, param, query } = require('express-validator');

const { validar } = require('../../../middleware/validator');
const { verificarToken, verificarRol } = require('../../../middleware/authMiddleware');
const { ROLES, ESTADOS_PERIODO } = require('../../../config/constants');
const ctrl = require('./periodos.controller');

const router = express.Router();

// Permisos según la matriz de 06-AUTH.md.
const VER = [ROLES.ADMIN_EMPRESA, ROLES.JEFE_NOMINA, ROLES.NOMINA, ROLES.TRABAJADOR_NOMINA];
const GESTIONAR = [ROLES.ADMIN_EMPRESA, ROLES.JEFE_NOMINA];

const TIPOS = ['semanal', 'quincenal', 'mensual'];
const idParam = param('id').isInt({ min: 1 }).withMessage('id inválido');

router.use(verificarToken);

// GET /api/nomina/periodos
router.get(
  '/',
  verificarRol(VER),
  [
    query('estado').optional().isIn(ESTADOS_PERIODO).withMessage('estado inválido'),
    query('page').optional().isInt({ min: 1 }).withMessage('page inválido'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('limit inválido'),
  ],
  validar,
  ctrl.listar
);

// POST /api/nomina/periodos
router.post(
  '/',
  verificarRol(GESTIONAR),
  [
    body('fecha_inicio').isISO8601().withMessage('fecha_inicio inválida (YYYY-MM-DD)'),
    body('fecha_fin').isISO8601().withMessage('fecha_fin inválida (YYYY-MM-DD)'),
    body('tipo').optional().isIn(TIPOS).withMessage('tipo inválido (semanal | quincenal | mensual)'),
  ],
  validar,
  ctrl.crear
);

// POST /api/nomina/periodos/:id/cerrar
router.post('/:id/cerrar', verificarRol(GESTIONAR), [idParam], validar, ctrl.cerrar);

// POST /api/nomina/periodos/:id/liquidar
router.post('/:id/liquidar', verificarRol(GESTIONAR), [idParam], validar, ctrl.liquidar);

module.exports = router;
