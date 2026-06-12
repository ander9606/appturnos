'use strict';

const express = require('express');

const { verificarToken, verificarRol } = require('../../middleware/authMiddleware');
const { ROLES } = require('../../config/constants');
const asignacionesCtrl = require('./asignaciones/asignaciones.controller');

/**
 * Agregador del módulo Turnos. Cada sección se monta como sub-router:
 *   /api/turnos/ofertas       → sección ofertas
 *   /api/turnos/asignaciones  → sección asignaciones
 *   /api/turnos/mis-turnos    → vista del trabajador (controlador de asignaciones)
 */
const router = express.Router();

router.use('/ofertas', require('./ofertas/ofertas.routes'));
router.use('/asignaciones', require('./asignaciones/asignaciones.routes'));

// GET /api/turnos/mis-turnos
router.get(
  '/mis-turnos',
  verificarToken,
  verificarRol([ROLES.TRABAJADOR_TURNOS, ROLES.TRABAJADOR_NOMINA]),
  asignacionesCtrl.misTurnos
);

module.exports = router;
