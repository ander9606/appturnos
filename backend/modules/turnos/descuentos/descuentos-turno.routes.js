'use strict';

const express = require('express');
const { body, param } = require('express-validator');

const { validar } = require('../../../middleware/validator');
const { verificarToken, verificarRol } = require('../../../middleware/authMiddleware');
const { ROLES } = require('../../../config/constants');
const ctrl = require('./descuentos-turno.controller');

const router = express.Router();

// Mismos roles que las asignaciones de turno (ver asignaciones.routes.js).
const GESTIONAR = [ROLES.ADMIN_EMPRESA, ROLES.JEFE_TURNOS];
const TRABAJADOR = [ROLES.TRABAJADOR_TURNOS, ROLES.TRABAJADOR_NOMINA];

const idParam = (nombre) => param(nombre).isInt({ min: 1 }).withMessage('id inválido');

router.use(verificarToken);

// GET /api/turnos/descuentos/asignacion/:asignacionId  (gestor, o el trabajador dueño del turno)
router.get('/asignacion/:asignacionId', [idParam('asignacionId')], validar, ctrl.listar);

// POST /api/turnos/descuentos/asignacion/:asignacionId  (gestor registra el descuento)
router.post(
  '/asignacion/:asignacionId',
  verificarRol(GESTIONAR),
  [
    idParam('asignacionId'),
    body('monto').isFloat({ gt: 0 }).withMessage('monto debe ser mayor a 0'),
    body('motivo').isString().trim().notEmpty().withMessage('El motivo es obligatorio')
      .isLength({ max: 255 }).withMessage('motivo inválido (máx. 255 caracteres)'),
  ],
  validar,
  ctrl.crear
);

// POST /api/turnos/descuentos/:id/responder  (el trabajador acepta o rechaza)
router.post(
  '/:id/responder',
  verificarRol(TRABAJADOR),
  [idParam('id'), body('aceptar').isBoolean().withMessage('aceptar debe ser true o false').toBoolean()],
  validar,
  ctrl.responder
);

// DELETE /api/turnos/descuentos/:id  (gestor retira un descuento registrado por error)
router.delete('/:id', verificarRol(GESTIONAR), [idParam('id')], validar, ctrl.eliminar);

module.exports = router;
