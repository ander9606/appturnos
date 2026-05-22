'use strict';

const express = require('express');
const { body } = require('express-validator');

const { validar } = require('../../middleware/validator');
const { verificarToken, verificarRol } = require('../../middleware/authMiddleware');
const { verificarFirmaLogiq360 } = require('../../middleware/verificarFirmaLogiq360');
const { ROLES } = require('../../config/constants');
const ctrl = require('./integracion.controller');

const router = express.Router();

const SOLO_ADMIN = [ROLES.ADMIN_EMPRESA];

// POST /api/integracion/eventos — webhook entrante de logiq360.
// Autenticado por firma HMAC, no por JWT.
router.post(
  '/eventos',
  verificarFirmaLogiq360,
  [
    body('event_id').notEmpty().withMessage('event_id requerido'),
    body('tipo_evento').notEmpty().withMessage('tipo_evento requerido'),
    body('tenant_id').isInt({ min: 1 }).withMessage('tenant_id inválido'),
    body('data').isObject().withMessage('data debe ser un objeto'),
  ],
  validar,
  ctrl.recibirEventos
);

// El resto son endpoints de administración (JWT + rol admin_empresa).

// GET /api/integracion/estado
router.get('/estado', verificarToken, verificarRol(SOLO_ADMIN), ctrl.estado);

// GET /api/integracion/configuracion
router.get('/configuracion', verificarToken, verificarRol(SOLO_ADMIN), ctrl.obtenerConfig);

// PUT /api/integracion/configuracion
router.put(
  '/configuracion',
  verificarToken,
  verificarRol(SOLO_ADMIN),
  [
    body('activo').optional().isBoolean().withMessage('activo debe ser booleano'),
    body('webhook_url').optional({ values: 'falsy' }).isURL().withMessage('webhook_url inválida'),
    body('webhook_secret').optional({ values: 'falsy' }).isString(),
    body('api_key').optional({ values: 'falsy' }).isString(),
    body('incoming_secret').optional({ values: 'falsy' }).isString(),
  ],
  validar,
  ctrl.actualizarConfig
);

module.exports = router;
