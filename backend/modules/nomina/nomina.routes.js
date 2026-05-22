'use strict';

const express = require('express');

/**
 * Agregador del módulo Nómina. Cada sección se monta como sub-router:
 *   /api/nomina/periodos     → ciclos de nómina
 *   /api/nomina/registros    → registros diarios de horas
 *   /api/nomina/liquidacion  → resumen y exportación
 */
const router = express.Router();

router.use('/periodos', require('./periodos/periodos.routes'));
router.use('/registros', require('./registros/registros.routes'));
router.use('/liquidacion', require('./liquidacion/liquidacion.routes'));

module.exports = router;
