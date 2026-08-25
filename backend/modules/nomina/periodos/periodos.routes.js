'use strict';

const express = require('express');
const { body, param, query } = require('express-validator');

const { validar } = require('../../../middleware/validator');
const { verificarToken, verificarRol } = require('../../../middleware/authMiddleware');
const verificarSuscripcion = require('../../../middleware/verificarSuscripcion');
const { ROLES, ESTADOS_PERIODO } = require('../../../config/constants');
const ctrl = require('./periodos.controller');

const router = express.Router();

// Permisos según la matriz de 06-AUTH.md.
// VER_TOTALES: roles con visibilidad real de nómina (montos a pagar).
// VER: además de esos, jefe_turnos/trabajador_turnos leen fecha_inicio/fecha_fin/tipo/estado
// de periodos_nomina para ubicar su propio ciclo de pago de turnos — NUNCA montos
// (el controller ignora `conTotales` si el rol no está en VER_TOTALES).
const VER_TOTALES = [ROLES.ADMIN_EMPRESA, ROLES.JEFE_NOMINA, ROLES.NOMINA, ROLES.TRABAJADOR_NOMINA];
const VER = [...VER_TOTALES, ROLES.JEFE_TURNOS, ROLES.TRABAJADOR_TURNOS];
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
    query('conTotales').optional().isBoolean().withMessage('conTotales inválido'),
  ],
  validar,
  ctrl.listar
);

// POST /api/nomina/periodos
router.post(
  '/',
  verificarRol(GESTIONAR),
  verificarSuscripcion,
  [
    body('fecha_inicio').isISO8601().withMessage('fecha_inicio inválida (YYYY-MM-DD)'),
    body('fecha_fin').isISO8601().withMessage('fecha_fin inválida (YYYY-MM-DD)'),
    body('tipo').optional().isIn(TIPOS).withMessage('tipo inválido (semanal | quincenal | mensual)'),
  ],
  validar,
  ctrl.crear
);

// POST /api/nomina/periodos/:id/cerrar
router.post('/:id/cerrar', verificarRol(GESTIONAR), verificarSuscripcion, [idParam], validar, ctrl.cerrar);

// POST /api/nomina/periodos/:id/liquidar
router.post('/:id/liquidar', verificarRol(GESTIONAR), verificarSuscripcion, [idParam], validar, ctrl.liquidar);

module.exports = router;
