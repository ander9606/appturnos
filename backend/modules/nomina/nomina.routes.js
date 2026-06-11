'use strict';

const express = require('express');
const { verificarToken, verificarRol } = require('../../middleware/authMiddleware');
const { ROLES } = require('../../config/constants');
const registrosCtrl = require('./registros/registros.controller');

/**
 * Agregador del módulo Nómina. Cada sección se monta como sub-router:
 *   GET  /api/nomina/me          → perfil del trabajador_nomina
 *   /api/nomina/periodos         → ciclos de nómina
 *   /api/nomina/registros        → registros diarios de horas
 *   /api/nomina/liquidacion      → resumen y exportación
 */
const router = express.Router();

// GET /api/nomina/me — perfil del trabajador_nomina (salario, tipo_marcacion, punto_marcaje)
router.get(
  '/me',
  verificarToken,
  verificarRol([ROLES.TRABAJADOR_NOMINA]),
  registrosCtrl.obtenerMiPerfil
);

router.use('/periodos',    require('./periodos/periodos.routes'));
router.use('/registros',   require('./registros/registros.routes'));
router.use('/liquidacion', require('./liquidacion/liquidacion.routes'));

module.exports = router;
