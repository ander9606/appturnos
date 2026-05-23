'use strict';

const express = require('express');
const { body, param } = require('express-validator');

const { validar } = require('../../middleware/validator');
const { verificarToken, verificarRol } = require('../../middleware/authMiddleware');
const { ROLES } = require('../../config/constants');
const ctrl = require('./contratos.controller');

const router = express.Router();

// Permisos según 03-API-ENDPOINTS.md. El acceso del trabajador a su
// propio contrato se valida además en el service.
const VER = [ROLES.ADMIN_EMPRESA, ROLES.JEFE_TURNOS, ROLES.TRABAJADOR_TURNOS];
const idParam = param('id').isInt({ min: 1 }).withMessage('id inválido');

router.use(verificarToken);

// GET /api/contratos/:id
router.get('/:id', verificarRol(VER), [idParam], validar, ctrl.obtener);

// GET /api/contratos/:id/pdf
router.get('/:id/pdf', verificarRol(VER), [idParam], validar, ctrl.pdf);

// POST /api/contratos/:id/firmar
router.post(
  '/:id/firmar',
  verificarRol([ROLES.TRABAJADOR_TURNOS]),
  [idParam, body('firma_b64').isString().notEmpty().withMessage('firma_b64 requerida')],
  validar,
  ctrl.firmar
);

module.exports = router;
