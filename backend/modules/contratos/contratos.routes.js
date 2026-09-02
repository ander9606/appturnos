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

// Promueve ?token= a header Authorization — usado solo por las rutas de PDF,
// que un navegador externo (WebBrowser.openBrowserAsync en mobile) abre sin
// poder mandar headers propios. Debe ejecutarse ANTES que verificarToken
// (que exige el header y corta con 401 si falta) — por eso estas dos rutas
// se registran antes del router.use(verificarToken) de abajo: un middleware
// registrado con .use() corre para toda request antes que cualquier handler
// de ruta definido después, sin importar qué haga ese handler internamente.
function promoverTokenDeQuery(req, res, next) {
  if (req.query.token && !req.headers.authorization) {
    req.headers.authorization = `Bearer ${req.query.token}`;
  }
  next();
}

// GET /api/contratos/asignacion/:asignacionId/pdf — resuelve el contrato del
// turno y descarga el PDF en un solo request.
router.get(
  '/asignacion/:asignacionId/pdf',
  promoverTokenDeQuery,
  verificarToken,
  verificarRol(VER),
  [param('asignacionId').isInt({ min: 1 }).withMessage('asignacionId inválido')],
  validar,
  ctrl.pdfPorAsignacion
);

// GET /api/contratos/:id/pdf — acepta ?token= para descarga desde app móvil
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

// GET /api/contratos — historial del trabajador autenticado
router.get('/', verificarRol([ROLES.TRABAJADOR_TURNOS]), ctrl.listar);

// GET /api/contratos/asignacion/:asignacionId
router.get(
  '/asignacion/:asignacionId',
  verificarRol(VER),
  [param('asignacionId').isInt({ min: 1 }).withMessage('asignacionId inválido')],
  validar,
  ctrl.obtenerPorAsignacion
);

// GET /api/contratos/:id
router.get('/:id', verificarRol(VER), [idParam], validar, ctrl.obtener);

// POST /api/contratos/:id/firmar
router.post(
  '/:id/firmar',
  verificarRol([ROLES.TRABAJADOR_TURNOS]),
  [idParam, body('firma_b64').isString().notEmpty().withMessage('firma_b64 requerida')],
  validar,
  ctrl.firmar
);

module.exports = router;
