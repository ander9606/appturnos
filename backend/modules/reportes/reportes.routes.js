'use strict';

const express = require('express');
const { param, query } = require('express-validator');

const { validar, rangoFechasMax } = require('../../middleware/validator');
const { verificarToken, verificarRol } = require('../../middleware/authMiddleware');
const { ROLES } = require('../../config/constants');
const ctrl = require('./reportes.controller');

const router = express.Router();

// Reportes: admin_empresa y jefes (matriz de 06-AUTH.md).
const VER = [ROLES.ADMIN_EMPRESA, ROLES.JEFE_TURNOS, ROLES.JEFE_NOMINA];

// Estos endpoints agregan sobre todo el rango sin paginar — sin tope, un
// rango de décadas es una query cara y barata de pedir repetidamente.
const reglasRango = [
  query('desde').optional().isISO8601().withMessage('desde inválida (YYYY-MM-DD)'),
  query('hasta').optional().isISO8601().withMessage('hasta inválida (YYYY-MM-DD)'),
  rangoFechasMax(366),
];

router.use(verificarToken);

// GET /api/reportes/resumen — el período se compara con el anterior de igual duración,
// así que aquí desde y hasta son obligatorios.
router.get(
  '/resumen',
  verificarRol(VER),
  [query('desde').isISO8601().withMessage('desde requerida (YYYY-MM-DD)'),
   query('hasta').isISO8601().withMessage('hasta requerida (YYYY-MM-DD)')
     .custom((hasta, { req }) => hasta >= req.query.desde).withMessage('hasta no puede ser anterior a desde'),
   rangoFechasMax(366)],
  validar,
  ctrl.resumen
);

// GET /api/reportes/personas — horas por persona (solo con nómina) y reparto de turnos por cargo.
router.get(
  '/personas',
  verificarRol(VER),
  [query('desde').isISO8601().withMessage('desde requerida (YYYY-MM-DD)'),
   query('hasta').isISO8601().withMessage('hasta requerida (YYYY-MM-DD)')
     .custom((hasta, { req }) => hasta >= req.query.desde).withMessage('hasta no puede ser anterior a desde'),
   rangoFechasMax(366)],
  validar,
  ctrl.personas
);

// GET /api/reportes/asistencia
router.get('/asistencia', verificarRol(VER), reglasRango, validar, ctrl.asistencia);

// GET /api/reportes/costos
router.get('/costos', verificarRol(VER), reglasRango, validar, ctrl.costos);

// GET /api/reportes/trabajador/:id
router.get(
  '/trabajador/:id',
  verificarRol(VER),
  [param('id').isInt({ min: 1 }).withMessage('id inválido'), ...reglasRango],
  validar,
  ctrl.trabajador
);

module.exports = router;
