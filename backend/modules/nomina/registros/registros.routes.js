'use strict';

const express = require('express');
const { body, param, query } = require('express-validator');

const { validar } = require('../../../middleware/validator');
const { verificarToken, verificarRol } = require('../../../middleware/authMiddleware');
const { ROLES } = require('../../../config/constants');
const ctrl = require('./registros.controller');

const router = express.Router();

// Permisos según la matriz de 06-AUTH.md.
const VER    = [ROLES.ADMIN_EMPRESA, ROLES.JEFE_NOMINA, ROLES.NOMINA, ROLES.TRABAJADOR_NOMINA];
const CREAR  = [ROLES.ADMIN_EMPRESA, ROLES.JEFE_NOMINA, ROLES.NOMINA, ROLES.TRABAJADOR_NOMINA];
const CORREGIR = [ROLES.ADMIN_EMPRESA, ROLES.JEFE_NOMINA];
const MARCAR = [ROLES.TRABAJADOR_NOMINA];

const TIPOS_DIA = ['ordinario', 'descanso', 'compensatorio', 'incapacidad', 'vacacion', 'licencia'];
const RE_HORA   = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;
const idParam   = param('id').isInt({ min: 1 }).withMessage('id inválido');

router.use(verificarToken);

// GET /api/nomina/registros
router.get(
  '/',
  verificarRol(VER),
  [
    query('periodo_id').optional().isInt({ min: 1 }).withMessage('periodo_id inválido'),
    query('trabajador_id').optional().isInt({ min: 1 }).withMessage('trabajador_id inválido'),
    query('fecha').optional().isISO8601().withMessage('fecha inválida'),
    query('page').optional().isInt({ min: 1 }).withMessage('page inválido'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('limit inválido'),
  ],
  validar,
  ctrl.listar
);

// POST /api/nomina/registros
router.post(
  '/',
  verificarRol(CREAR),
  [
    body('periodo_id').isInt({ min: 1 }).withMessage('periodo_id es obligatorio'),
    body('fecha').isISO8601().withMessage('fecha inválida (YYYY-MM-DD)'),
    body('hora_entrada').matches(RE_HORA).withMessage('hora_entrada inválida (HH:MM)'),
    body('hora_salida')
      .optional({ values: 'falsy' })
      .matches(RE_HORA)
      .withMessage('hora_salida inválida (HH:MM)'),
    body('trabajador_id').optional().isInt({ min: 1 }).withMessage('trabajador_id inválido'),
    body('novedad').optional({ values: 'falsy' }).isString(),
  ],
  validar,
  ctrl.crear
);

// POST /api/nomina/registros/marcar-entrada  (trabajador_nomina only)
// IMPORTANT: must be declared before /:id routes to avoid route collision
router.post(
  '/marcar-entrada',
  verificarRol(MARCAR),
  [
    body('latitud').optional().isFloat({ min: -90,  max: 90  }).withMessage('latitud inválida'),
    body('longitud').optional().isFloat({ min: -180, max: 180 }).withMessage('longitud inválida'),
  ],
  validar,
  ctrl.marcarEntrada
);

// POST /api/nomina/registros/:id/marcar-salida  (trabajador_nomina only)
router.post(
  '/:id/marcar-salida',
  verificarRol(MARCAR),
  [
    idParam,
    body('latitud').optional().isFloat({ min: -90,  max: 90  }).withMessage('latitud inválida'),
    body('longitud').optional().isFloat({ min: -180, max: 180 }).withMessage('longitud inválida'),
  ],
  validar,
  ctrl.marcarSalida
);

// PUT /api/nomina/registros/:id  (corregir)
router.put(
  '/:id',
  verificarRol(CORREGIR),
  [
    idParam,
    body('hora_entrada').optional({ values: 'falsy' }).matches(RE_HORA).withMessage('hora_entrada inválida'),
    body('hora_salida').optional({ values: 'falsy' }).matches(RE_HORA).withMessage('hora_salida inválida'),
    body('novedad').optional({ values: 'falsy' }).isString(),
    body('tipo_dia').optional().isIn(TIPOS_DIA).withMessage('tipo_dia inválido'),
  ],
  validar,
  ctrl.corregir
);

module.exports = router;
