'use strict';

const express = require('express');
const { param } = require('express-validator');
const { validar } = require('../../middleware/validator');
const { verificarToken, verificarRol } = require('../../middleware/authMiddleware');
const verificarSuscripcion = require('../../middleware/verificarSuscripcion');
const { ROLES } = require('../../config/constants');
const ctrl = require('./turnos-eventual.controller');

const router = express.Router();

const GESTORES = [ROLES.ADMIN_EMPRESA, ROLES.JEFE_TURNOS, ROLES.JEFE_NOMINA];
// trabajador_nomina también puede ver — el service filtra a su propia línea únicamente
// (mismo criterio que backend/modules/nomina/liquidacion/liquidacion.routes.js).
const VER      = [...GESTORES, ROLES.TRABAJADOR_NOMINA];
const idParam  = param('id').isInt({ min: 1 }).toInt().withMessage('id inválido');

router.get('/periodo-activo', verificarToken, verificarRol(VER), ctrl.periodoActivo);
router.get('/:id/liquidacion', verificarToken, verificarRol(VER), [idParam], validar, ctrl.liquidacion);
router.post('/:id/liquidar',   verificarToken, verificarRol(GESTORES), verificarSuscripcion, [idParam], validar, ctrl.liquidar);

module.exports = router;
