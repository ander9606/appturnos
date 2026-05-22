'use strict';

const express = require('express');
const { param, query } = require('express-validator');

const { validar } = require('../../middleware/validator');
const { verificarToken, verificarRol } = require('../../middleware/authMiddleware');
const { ROLES } = require('../../config/constants');
const ctrl = require('./reportes.controller');

const router = express.Router();

// Reportes: admin_empresa y jefes (matriz de 06-AUTH.md).
const VER = [ROLES.ADMIN_EMPRESA, ROLES.JEFE_TURNOS, ROLES.JEFE_NOMINA];

const reglasRango = [
  query('desde').optional().isISO8601().withMessage('desde inválida (YYYY-MM-DD)'),
  query('hasta').optional().isISO8601().withMessage('hasta inválida (YYYY-MM-DD)'),
];

router.use(verificarToken);

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
