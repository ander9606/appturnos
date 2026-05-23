'use strict';

const express = require('express');
const { param } = require('express-validator');

const { validar } = require('../../../middleware/validator');
const { verificarToken, verificarRol } = require('../../../middleware/authMiddleware');
const { ROLES } = require('../../../config/constants');
const ctrl = require('./liquidacion.controller');

const router = express.Router();

// Liquidación: solo admin_empresa y jefe_nomina (matriz de 06-AUTH.md).
const VER = [ROLES.ADMIN_EMPRESA, ROLES.JEFE_NOMINA];
const periodoParam = param('periodo_id').isInt({ min: 1 }).withMessage('periodo_id inválido');

router.use(verificarToken);

// GET /api/nomina/liquidacion/:periodo_id
router.get('/:periodo_id', verificarRol(VER), [periodoParam], validar, ctrl.obtener);

// GET /api/nomina/liquidacion/:periodo_id/export
router.get('/:periodo_id/export', verificarRol(VER), [periodoParam], validar, ctrl.exportar);

module.exports = router;
