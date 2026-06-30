'use strict';

const express = require('express');
const { body, param, query } = require('express-validator');
const { validar } = require('../../middleware/validator');
const { verificarToken, verificarRol } = require('../../middleware/authMiddleware');
const { ROLES } = require('../../config/constants');
const ctrl = require('./ausencias.controller');

const router = express.Router();

const TODOS   = Object.values(ROLES).filter((r) => r !== ROLES.SUPER_ADMIN);
const GESTORES = [ROLES.ADMIN_EMPRESA, ROLES.JEFE_TURNOS, ROLES.JEFE_NOMINA];

router.use(verificarToken);

// GET /api/ausencias — gestor: lista todas; trabajador: solo las propias
router.get(
  '/',
  verificarRol(TODOS),
  [
    query('estado').optional().isIn(['pendiente','aprobada','rechazada']).withMessage('estado inválido'),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
  ],
  validar,
  ctrl.listar
);

// GET /api/ausencias/pendientes-count — badge para gestores
router.get('/pendientes-count', verificarRol(GESTORES), ctrl.contarPendientes);

// POST /api/ausencias — trabajador crea solicitud
router.post(
  '/',
  verificarRol([ROLES.TRABAJADOR_TURNOS, ROLES.TRABAJADOR_NOMINA]),
  [
    body('tipo').isIn(['vacaciones','permiso','incapacidad','otro']).withMessage('tipo inválido'),
    body('fecha_inicio').isISO8601().withMessage('fecha_inicio inválida'),
    body('fecha_fin').isISO8601().withMessage('fecha_fin inválida'),
    body('motivo').optional({ values: 'falsy' }).isString().trim().isLength({ max: 500 }),
  ],
  validar,
  ctrl.crear
);

// PATCH /api/ausencias/:id/estado — gestor aprueba/rechaza
router.patch(
  '/:id/estado',
  verificarRol(GESTORES),
  [
    param('id').isInt({ min: 1 }).withMessage('id inválido'),
    body('estado').isIn(['aprobada','rechazada']).withMessage('estado inválido'),
  ],
  validar,
  ctrl.actualizarEstado
);

module.exports = router;