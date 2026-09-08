'use strict';

const express = require('express');
const { body, param } = require('express-validator');

const { validar } = require('../../middleware/validator');
const { verificarToken, verificarRol } = require('../../middleware/authMiddleware');
const verificarSuscripcion = require('../../middleware/verificarSuscripcion');
const { ROLES } = require('../../config/constants');
const ctrl = require('./cuentas-cobro.controller');

const router = express.Router();

const VER = [ROLES.ADMIN_EMPRESA, ROLES.JEFE_NOMINA, ROLES.TRABAJADOR_TURNOS];
const GESTIONAR = [ROLES.ADMIN_EMPRESA, ROLES.JEFE_NOMINA];
const idParam = param('id').isInt({ min: 1 }).withMessage('id inválido');

// Promueve ?token= a header Authorization — mismo patrón que contratos.routes.js,
// usado solo por la ruta de PDF que WebBrowser.openBrowserAsync abre sin headers.
function promoverTokenDeQuery(req, res, next) {
  if (req.query.token && !req.headers.authorization) {
    req.headers.authorization = `Bearer ${req.query.token}`;
  }
  next();
}

// GET /api/cuentas-cobro/:id/pdf — acepta ?token= para descarga desde app móvil
router.get(
  '/:id/pdf',
  promoverTokenDeQuery,
  verificarToken,
  verificarRol(VER),
  [idParam],
  validar,
  ctrl.pdf
);

router.use(verificarToken);

// GET /api/cuentas-cobro — historial del trabajador autenticado
router.get('/', verificarRol([ROLES.TRABAJADOR_TURNOS]), ctrl.listar);

// GET /api/cuentas-cobro/sin-firmar — pendientes de firma
router.get('/sin-firmar', verificarRol([ROLES.TRABAJADOR_TURNOS]), ctrl.listarSinFirmar);

// GET /api/cuentas-cobro/:id
router.get('/:id', verificarRol(VER), [idParam], validar, ctrl.obtener);

// POST /api/cuentas-cobro/:id/firmar
router.post(
  '/:id/firmar',
  verificarRol([ROLES.TRABAJADOR_TURNOS]),
  [idParam, body('firma_b64').isString().notEmpty().withMessage('firma_b64 requerida')],
  validar,
  ctrl.firmar
);

// POST /api/cuentas-cobro/periodo/:periodoId/regenerar — recuperación manual:
// re-corre la generación para todo el período (ver contratos_diarios firmados
// después del cierre, que el cierre automático no pudo capturar).
router.post(
  '/periodo/:periodoId/regenerar',
  verificarRol(GESTIONAR),
  verificarSuscripcion,
  [param('periodoId').isInt({ min: 1 }).withMessage('periodoId inválido')],
  validar,
  ctrl.regenerarParaPeriodo
);

module.exports = router;
