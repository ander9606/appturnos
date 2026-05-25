'use strict';

const express = require('express');
const { body, param } = require('express-validator');

const { validar } = require('../../../../middleware/validator');
const { verificarToken, verificarRol } = require('../../../../middleware/authMiddleware');
const { ROLES } = require('../../../../config/constants');
const ctrl = require('./puestos.controller');

// Router merge-aware: queremos acceder a `:id` (oferta) desde el padre.
const router = express.Router({ mergeParams: true });

const GESTIONAR = [ROLES.ADMIN_EMPRESA, ROLES.JEFE_TURNOS];

router.use(verificarToken);

// GET /api/turnos/ofertas/:id/puestos
router.get('/', verificarRol(GESTIONAR), ctrl.listar);

// POST /api/turnos/ofertas/:id/puestos
router.post(
  '/',
  verificarRol(GESTIONAR),
  [
    body('cargo_id').isInt({ min: 1 }).withMessage('cargo_id requerido'),
    body('plazas').optional().isInt({ min: 1 }).withMessage('plazas debe ser un entero ≥ 1'),
    body('tarifa_dia').isFloat({ min: 0 }).withMessage('tarifa_dia inválida'),
    body('notas').optional().isString().trim().isLength({ max: 255 }),
  ],
  validar,
  ctrl.agregar
);

// PATCH /api/turnos/ofertas/:id/puestos/:puestoId
router.patch(
  '/:puestoId',
  verificarRol(GESTIONAR),
  [
    param('puestoId').isInt({ min: 1 }).toInt(),
    body('plazas').optional().isInt({ min: 1 }),
    body('tarifa_dia').optional().isFloat({ min: 0 }),
    body('notas').optional({ nullable: true }).isString().trim().isLength({ max: 255 }),
  ],
  validar,
  ctrl.actualizar
);

// DELETE /api/turnos/ofertas/:id/puestos/:puestoId
router.delete(
  '/:puestoId',
  verificarRol(GESTIONAR),
  [param('puestoId').isInt({ min: 1 }).toInt()],
  validar,
  ctrl.eliminar
);

module.exports = router;
