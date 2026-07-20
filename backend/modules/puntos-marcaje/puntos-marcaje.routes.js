'use strict';

const express = require('express');
const { body, param } = require('express-validator');
const { validar } = require('../../middleware/validator');
const { verificarToken, verificarRol } = require('../../middleware/authMiddleware');
const { ROLES } = require('../../config/constants');
const ctrl = require('./puntos-marcaje.controller');

const router = express.Router();

const GESTIONAR = [ROLES.ADMIN_EMPRESA, ROLES.JEFE_TURNOS];
const VER       = [ROLES.ADMIN_EMPRESA, ROLES.JEFE_TURNOS, ROLES.JEFE_NOMINA, ROLES.NOMINA];

const idParam = param('id').isInt({ min: 1 }).withMessage('id inválido');

const reglasBase = [
  body('nombre').isString().trim().notEmpty().withMessage('Nombre requerido'),
  body('descripcion').optional().isString().trim(),
  body('latitud').isFloat({ min: -90, max: 90 }).withMessage('Latitud inválida'),
  body('longitud').isFloat({ min: -180, max: 180 }).withMessage('Longitud inválida'),
  body('radio_metros').optional().isInt({ min: 10, max: 5000 }),
  body('tipo').optional().isIn(['fijo', 'zonal']).withMessage('tipo debe ser fijo o zonal'),
  body('activo').optional().isBoolean().withMessage('activo debe ser booleano'),
];

router.use(verificarToken);

// GET /api/puntos-marcaje
router.get('/', verificarRol(VER), ctrl.listar);

// POST /api/puntos-marcaje
router.post('/', verificarRol(GESTIONAR), reglasBase, validar, ctrl.crear);

// PATCH /api/puntos-marcaje/:id
router.patch(
  '/:id',
  verificarRol(GESTIONAR),
  [idParam, ...reglasBase.map((r) => r.optional())],
  validar,
  ctrl.actualizar
);

// DELETE /api/puntos-marcaje/:id
router.delete('/:id', verificarRol(GESTIONAR), [idParam], validar, ctrl.eliminar);

module.exports = router;
