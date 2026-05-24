'use strict';

const express = require('express');
const { body, param, query } = require('express-validator');

const { validar } = require('../../middleware/validator');
const { verificarToken, verificarRol } = require('../../middleware/authMiddleware');
const { ROLES } = require('../../config/constants');
const ctrl = require('./trabajador-empresa.controller');
const cargosCtrl = require('../cargos/cargos.controller');

const router = express.Router();

const SOLO_TURNOS = [ROLES.TRABAJADOR_TURNOS];
const SOLO_JEFE = [ROLES.JEFE_TURNOS, ROLES.ADMIN_EMPRESA];

// POST /api/trabajador-empresa/solicitar — el trabajador pide sumarse a una empresa
router.post(
  '/solicitar',
  verificarToken,
  verificarRol(SOLO_TURNOS),
  [body('empresa_id').isInt({ min: 1 }).withMessage('empresa_id inválido')],
  validar,
  ctrl.solicitar
);

// POST /api/trabajador-empresa/invitar — la empresa invita a un trabajador por cédula
router.post(
  '/invitar',
  verificarToken,
  verificarRol(SOLO_JEFE),
  [body('cedula').isString().trim().notEmpty().withMessage('cédula requerida')],
  validar,
  ctrl.invitar
);

// POST /api/trabajador-empresa/:id/aprobar — jefe aprueba solicitud del trabajador
router.post(
  '/:id/aprobar',
  verificarToken,
  verificarRol(SOLO_JEFE),
  [param('id').isInt({ min: 1 }).toInt()],
  validar,
  ctrl.aprobar
);

// POST /api/trabajador-empresa/:id/aceptar — trabajador acepta invitación de la empresa
router.post(
  '/:id/aceptar',
  verificarToken,
  verificarRol(SOLO_TURNOS),
  [param('id').isInt({ min: 1 }).toInt()],
  validar,
  ctrl.aceptar
);

// POST /api/trabajador-empresa/:id/rechazar — ambos pueden rechazar
router.post(
  '/:id/rechazar',
  verificarToken,
  [
    param('id').isInt({ min: 1 }).toInt(),
    body('motivo').optional().isString().trim(),
  ],
  validar,
  ctrl.rechazar
);

// POST /api/trabajador-empresa/:id/archivar — ambos pueden archivar (desde activo)
router.post(
  '/:id/archivar',
  verificarToken,
  [param('id').isInt({ min: 1 }).toInt()],
  validar,
  ctrl.archivar
);

// GET /api/trabajador-empresa/mis-empresas — el trabajador ve sus vínculos
router.get(
  '/mis-empresas',
  verificarToken,
  verificarRol(SOLO_TURNOS),
  ctrl.misEmpresas
);

// GET /api/trabajador-empresa/solicitudes — el jefe ve las solicitudes de su empresa
router.get(
  '/solicitudes',
  verificarToken,
  verificarRol(SOLO_JEFE),
  [query('estado').optional().isString()],
  validar,
  ctrl.solicitudes
);

// ---- Cargos certificados por la empresa a este trabajador ----
// Ref: APP-TURNOS-SPEC/06-AUTH.md y migración 012_cargos.

// GET /api/trabajador-empresa/:id/cargos — cargos del trabajador en mi empresa
router.get(
  '/:id/cargos',
  verificarToken,
  verificarRol(SOLO_JEFE),
  [param('id').isInt({ min: 1 }).toInt()],
  validar,
  cargosCtrl.listarCargosDeVinculo
);

// POST /api/trabajador-empresa/:id/cargos — asignar un cargo al trabajador
router.post(
  '/:id/cargos',
  verificarToken,
  verificarRol(SOLO_JEFE),
  [
    param('id').isInt({ min: 1 }).toInt(),
    body('cargo_id').isInt({ min: 1 }).withMessage('cargo_id requerido'),
  ],
  validar,
  cargosCtrl.asignarCargoAVinculo
);

// DELETE /api/trabajador-empresa/:id/cargos/:cargoId — quitar un cargo
router.delete(
  '/:id/cargos/:cargoId',
  verificarToken,
  verificarRol(SOLO_JEFE),
  [
    param('id').isInt({ min: 1 }).toInt(),
    param('cargoId').isInt({ min: 1 }).toInt(),
  ],
  validar,
  cargosCtrl.desasignarCargoDeVinculo
);

module.exports = router;
