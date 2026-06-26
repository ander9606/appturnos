'use strict';

const express = require('express');
const { body, param, query } = require('express-validator');

const { validar } = require('../../middleware/validator');
const { verificarToken, verificarRol } = require('../../middleware/authMiddleware');
const { ROLES } = require('../../config/constants');
const ctrl = require('./admin.controller');

const router = express.Router();

// Todos los endpoints de este módulo requieren ser super_admin.
const SOLO_SUPER = [ROLES.SUPER_ADMIN];

// ── Reportes ──────────────────────────────────────────────────────────────

// GET /api/admin/reportes/global
router.get(
  '/reportes/global',
  verificarToken,
  verificarRol(SOLO_SUPER),
  ctrl.reportesGlobales
);

// ── Empresas ──────────────────────────────────────────────────────────────

// GET /api/admin/empresas
router.get(
  '/empresas',
  verificarToken,
  verificarRol(SOLO_SUPER),
  [
    query('busqueda').optional().isString().trim(),
    query('plan').optional().isIn(['basico', 'profesional', 'empresarial']),
    query('activo').optional().isIn(['true', 'false']),
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  ],
  validar,
  ctrl.listarEmpresas
);

// GET /api/admin/empresas/:id
router.get(
  '/empresas/:id',
  verificarToken,
  verificarRol(SOLO_SUPER),
  [param('id').isInt({ min: 1 }).toInt()],
  validar,
  ctrl.obtenerEmpresa
);

// POST /api/admin/empresas
router.post(
  '/empresas',
  verificarToken,
  verificarRol(SOLO_SUPER),
  [
    body('nombre').isString().trim().notEmpty().withMessage('nombre requerido'),
    body('slug')
      .isString()
      .trim()
      .notEmpty()
      .matches(/^[a-z0-9-]+$/)
      .withMessage('slug: solo letras minúsculas, números y guiones'),
    body('nit').optional({ nullable: true }).isString().trim(),
    body('ciudad').optional({ nullable: true }).isString().trim(),
    body('plan')
      .optional()
      .isIn(['basico', 'profesional', 'empresarial'])
      .withMessage('plan inválido'),
    body('descripcion').optional({ nullable: true }).isString().trim(),
  ],
  validar,
  ctrl.crearEmpresa
);

// PUT /api/admin/empresas/:id
router.put(
  '/empresas/:id',
  verificarToken,
  verificarRol(SOLO_SUPER),
  [
    param('id').isInt({ min: 1 }).toInt(),
    body('nombre').optional().isString().trim().notEmpty(),
    body('nit').optional({ nullable: true }).isString().trim(),
    body('ciudad').optional({ nullable: true }).isString().trim(),
    body('plan').optional().isIn(['basico', 'profesional', 'empresarial']),
    body('acepta_postulaciones').optional().isBoolean().toBoolean(),
    body('descripcion').optional({ nullable: true }).isString().trim(),
    body('logo_url').optional({ nullable: true }).isURL().withMessage('logo_url debe ser una URL válida'),
  ],
  validar,
  ctrl.actualizarEmpresa
);

// POST /api/admin/empresas/:id/link-pago
router.post(
  '/empresas/:id/link-pago',
  verificarToken,
  verificarRol(SOLO_SUPER),
  [
    param('id').isInt({ min: 1 }).toInt(),
    body('plan').isIn(['basico', 'profesional', 'empresarial']).withMessage('plan requerido'),
    body('meses').optional().isInt({ min: 1, max: 12 }).toInt(),
  ],
  validar,
  ctrl.generarLinkPago
);

// PATCH /api/admin/empresas/:id/suscripcion
router.patch(
  '/empresas/:id/suscripcion',
  verificarToken,
  verificarRol(SOLO_SUPER),
  [
    param('id').isInt({ min: 1 }).toInt(),
    body('plan').optional().isIn(['basico', 'profesional', 'empresarial']),
    body('vigente_hasta').optional({ nullable: true }).custom((v) => {
      if (v === null) return true;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) throw new Error('vigente_hasta debe ser YYYY-MM-DD o null');
      return true;
    }),
    body('origen').optional().isIn(['manual', 'wompi', 'logiq360']),
  ],
  validar,
  ctrl.gestionarSuscripcion
);

// PATCH /api/admin/empresas/:id/estado
router.patch(
  '/empresas/:id/estado',
  verificarToken,
  verificarRol(SOLO_SUPER),
  [
    param('id').isInt({ min: 1 }).toInt(),
    body('activo').isBoolean().toBoolean().withMessage('activo debe ser true o false'),
  ],
  validar,
  ctrl.cambiarEstadoEmpresa
);

module.exports = router;
