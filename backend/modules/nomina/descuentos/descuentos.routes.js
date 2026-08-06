'use strict';

const express = require('express');
const { body, param, query } = require('express-validator');
const { validar } = require('../../../middleware/validator');
const { verificarToken, verificarRol } = require('../../../middleware/authMiddleware');
const { ROLES } = require('../../../config/constants');
const ctrl = require('./descuentos.controller');

const router = express.Router();
router.use(verificarToken);

const ROLES_GESTOR = [ROLES.ADMIN_EMPRESA, ROLES.JEFE_NOMINA];
const TIPOS = ['prestamo', 'inasistencia', 'dano_equipo', 'anticipo', 'otro'];
const idParam = param('id').isInt({ min: 1 }).withMessage('id inválido');

// GET /api/nomina/descuentos?periodo_id=&estado=
router.get(
  '/',
  verificarRol([...ROLES_GESTOR, ROLES.NOMINA, ROLES.TRABAJADOR_NOMINA]),
  [
    query('periodo_id').optional().isInt({ min: 1 }).withMessage('periodo_id inválido'),
    query('estado').optional().isIn(['pendiente', 'aceptado', 'rechazado']).withMessage('estado inválido'),
  ],
  validar,
  ctrl.listar
);

// POST /api/nomina/descuentos
router.post(
  '/',
  verificarRol(ROLES_GESTOR),
  [
    body('trabajador_id').isInt({ min: 1 }).withMessage('trabajador_id es obligatorio'),
    body('periodo_id').isInt({ min: 1 }).withMessage('periodo_id es obligatorio'),
    body('tipo').isIn(TIPOS).withMessage(`tipo inválido (${TIPOS.join(' | ')})`),
    body('motivo').trim().notEmpty().withMessage('motivo es obligatorio').isLength({ max: 255 }),
    body('monto').isFloat({ min: 0.01 }).withMessage('monto debe ser mayor a 0'),
  ],
  validar,
  ctrl.crear
);

// POST /api/nomina/descuentos/:id/aceptar — el trabajador acepta su propio descuento
router.post('/:id/aceptar', verificarRol([ROLES.TRABAJADOR_NOMINA]), [idParam], validar, ctrl.aceptar);

// POST /api/nomina/descuentos/:id/rechazar — el trabajador rechaza su propio descuento
router.post('/:id/rechazar', verificarRol([ROLES.TRABAJADOR_NOMINA]), [idParam], validar, ctrl.rechazar);

// DELETE /api/nomina/descuentos/:id
router.delete('/:id', verificarRol(ROLES_GESTOR), [idParam], validar, ctrl.eliminar);

module.exports = router;
