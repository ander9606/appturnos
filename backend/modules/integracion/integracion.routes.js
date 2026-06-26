'use strict';

const express = require('express');
const { body } = require('express-validator');

const { validar } = require('../../middleware/validator');
const { verificarToken, verificarRol } = require('../../middleware/authMiddleware');
const { verificarFirmaLogiq360 } = require('../../middleware/verificarFirmaLogiq360');
const { verificarApiKeyLogiq360 } = require('../../middleware/verificarApiKeyLogiq360');
const { ROLES } = require('../../config/constants');
const ctrl = require('./integracion.controller');

const router = express.Router();

const SOLO_ADMIN = [ROLES.ADMIN_EMPRESA];
const VER_ESTADO = [ROLES.ADMIN_EMPRESA, ROLES.JEFE_TURNOS];

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

// GET /api/integracion/estado — admin + jefe_turnos (lectura)
router.get('/estado', verificarToken, verificarRol(VER_ESTADO), ctrl.estado);

// POST /api/integracion/reintentar-fallidos
router.post('/reintentar-fallidos', verificarToken, verificarRol(SOLO_ADMIN), ctrl.reintentarFallidos);

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

// POST /api/integracion/emparejar — conectar con logiq360 vía código de pairing
router.post(
  '/emparejar',
  verificarToken,
  verificarRol(SOLO_ADMIN),
  [body('codigo').notEmpty().withMessage('codigo requerido').isString()],
  validar,
  ctrl.emparejar
);

// GET /api/integracion/conciliacion — personal sin vincular + candidatos logiq360
router.get('/conciliacion', verificarToken, verificarRol(SOLO_ADMIN), ctrl.conciliacion);

// POST /api/integracion/conciliacion/vincular — vincular trabajador ↔ empleado
router.post(
  '/conciliacion/vincular',
  verificarToken,
  verificarRol(SOLO_ADMIN),
  [
    body('trabajador_id').isInt({ min: 1 }).withMessage('trabajador_id inválido'),
    body('empleado_id').isInt({ min: 1 }).withMessage('empleado_id inválido'),
  ],
  validar,
  ctrl.vincularEmpleado
);

// ── Endpoints pull que logiq360 consulta con X-API-Key ───────────────────────
// GET /api/integracion/public/ping — test de conectividad y autenticación
router.get('/public/ping', verificarApiKeyLogiq360, ctrl.publicPing);

// GET /api/integracion/public/estado/:external_ref — estado de oferta y contratos
router.get(
  '/public/estado/:external_ref',
  verificarApiKeyLogiq360,
  ctrl.publicEstado
);

// GET /api/integracion/public/en-sitio/:external_ref — quién está en campo ahora
router.get(
  '/public/en-sitio/:external_ref',
  verificarApiKeyLogiq360,
  ctrl.publicEnSitio
);

// GET /api/integracion/public/trabajadores — lista de personal de turnos para sync
router.get('/public/trabajadores', verificarApiKeyLogiq360, ctrl.publicTrabajadores);

module.exports = router;
