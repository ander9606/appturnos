'use strict';

const express = require('express');
const { body, param } = require('express-validator');

const { validar } = require('../../middleware/validator');
const { verificarToken, verificarRol } = require('../../middleware/authMiddleware');
const { ROLES } = require('../../config/constants');
const ctrl = require('./cargos.controller');

const router = express.Router();

const PUEDE_GESTIONAR = [ROLES.JEFE_TURNOS, ROLES.ADMIN_EMPRESA];

const codigoOpcional = body('codigo')
  .optional()
  .isString()
  .trim()
  .matches(/^[a-z0-9_]+$/)
  .withMessage('codigo solo puede tener minúsculas, números y guiones bajos')
  .isLength({ min: 2, max: 50 });

// GET /api/cargos — catálogo visible (sistema + custom de mi empresa).
router.get('/', verificarToken, ctrl.listar);

// POST /api/cargos — crear cargo custom (solo jefe_turnos/admin).
router.post(
  '/',
  verificarToken,
  verificarRol(PUEDE_GESTIONAR),
  [
    codigoOpcional,
    body('nombre').isString().trim().isLength({ min: 2, max: 100 }),
    body('descripcion').optional().isString().trim().isLength({ max: 255 }),
  ],
  validar,
  ctrl.crear
);

// PATCH /api/cargos/:id — editar cargo custom.
router.patch(
  '/:id',
  verificarToken,
  verificarRol(PUEDE_GESTIONAR),
  [
    param('id').isInt({ min: 1 }).toInt(),
    body('nombre').optional().isString().trim().isLength({ min: 2, max: 100 }),
    body('descripcion').optional({ nullable: true }).isString().trim().isLength({ max: 255 }),
    body('activo').optional().isBoolean(),
  ],
  validar,
  ctrl.actualizar
);

// DELETE /api/cargos/:id — borra (o desactiva si está en uso).
router.delete(
  '/:id',
  verificarToken,
  verificarRol(PUEDE_GESTIONAR),
  [param('id').isInt({ min: 1 }).toInt()],
  validar,
  ctrl.eliminar
);

module.exports = router;
