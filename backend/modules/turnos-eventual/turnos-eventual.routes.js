'use strict';

const express = require('express');
const { param } = require('express-validator');
const { validar } = require('../../middleware/validator');
const { verificarToken, verificarRol } = require('../../middleware/authMiddleware');
const { ROLES } = require('../../config/constants');
const ctrl = require('./turnos-eventual.controller');

const router = express.Router();

const GESTORES = [ROLES.ADMIN_EMPRESA, ROLES.JEFE_TURNOS, ROLES.JEFE_NOMINA];
const idParam  = param('id').isInt({ min: 1 }).toInt().withMessage('id inválido');

router.get('/periodo-activo', verificarToken, verificarRol(GESTORES), ctrl.periodoActivo);
router.get('/:id/liquidacion', verificarToken, verificarRol(GESTORES), [idParam], validar, ctrl.liquidacion);
router.post('/:id/liquidar',   verificarToken, verificarRol(GESTORES), [idParam], validar, ctrl.liquidar);

module.exports = router;
