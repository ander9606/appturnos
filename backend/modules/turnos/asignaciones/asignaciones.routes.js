'use strict';

const express = require('express');
const { body, param, query } = require('express-validator');

const { validar } = require('../../../middleware/validator');
const { verificarToken, verificarRol } = require('../../../middleware/authMiddleware');
const { ROLES } = require('../../../config/constants');
const ctrl = require('./asignaciones.controller');

const router = express.Router();

// Permisos según la matriz de 06-AUTH.md.
const GESTIONAR = [ROLES.ADMIN_EMPRESA, ROLES.JEFE_TURNOS];
const TRABAJADOR = [ROLES.TRABAJADOR_TURNOS];

const idParam = param('id').isInt({ min: 1 }).withMessage('id inválido');

// Coordenadas GPS obligatorias para el marcaje de ingreso.
const reglasCoordenadas = [
  body('latitud').isFloat({ min: -90, max: 90 }).withMessage('latitud requerida y válida'),
  body('longitud').isFloat({ min: -180, max: 180 }).withMessage('longitud requerida y válida'),
];

router.use(verificarToken);

// GET /api/turnos/asignaciones
router.get(
  '/',
  verificarRol(GESTIONAR),
  [
    query('fecha').optional().isISO8601().withMessage('fecha inválida'),
    query('oferta_id').optional().isInt({ min: 1 }).withMessage('oferta_id inválido'),
    query('trabajador_id').optional().isInt({ min: 1 }).withMessage('trabajador_id inválido'),
    query('page').optional().isInt({ min: 1 }).withMessage('page inválido'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('limit inválido'),
  ],
  validar,
  ctrl.listar
);

// POST /api/turnos/asignaciones/:id/confirmar
router.post('/:id/confirmar', verificarRol(GESTIONAR), [idParam], validar, ctrl.confirmar);

// POST /api/turnos/asignaciones/:id/ingreso
router.post(
  '/:id/ingreso',
  verificarRol(TRABAJADOR),
  [idParam, ...reglasCoordenadas],
  validar,
  ctrl.ingreso
);

// POST /api/turnos/asignaciones/:id/egreso
router.post(
  '/:id/egreso',
  verificarRol(TRABAJADOR),
  [idParam, body('firma_b64').isString().notEmpty().withMessage('firma_b64 requerida')],
  validar,
  ctrl.egreso
);

module.exports = router;
