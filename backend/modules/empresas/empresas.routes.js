'use strict';

const express = require('express');
const { body, query, param } = require('express-validator');

const { validar } = require('../../middleware/validator');
const { verificarToken, verificarRol } = require('../../middleware/authMiddleware');
const { ROLES } = require('../../config/constants');
const ctrl = require('./empresas.controller');

const router = express.Router();

const PUEDEN_VER_DIRECTORIO = [
  ROLES.TRABAJADOR_TURNOS,
  ROLES.ADMIN_EMPRESA,
  ROLES.JEFE_TURNOS,
];

const SOLO_ADMIN = [ROLES.ADMIN_EMPRESA];

// GET /api/empresas/directorio
router.get(
  '/directorio',
  verificarToken,
  verificarRol(PUEDEN_VER_DIRECTORIO),
  [
    query('busqueda').optional().isString().trim(),
    query('ciudad').optional().isString().trim(),
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 50 }).toInt(),
  ],
  validar,
  ctrl.directorio
);

// GET /api/empresas/suscripcion — cualquier rol autenticado consulta el estado de su suscripción
router.get('/suscripcion', verificarToken, async (req, res, next) => {
  try {
    const [[e]] = await require('../../config/database').pool.query(
      'SELECT plan, suscripcion_vigente_hasta FROM empresas WHERE id = ? AND activo = 1 LIMIT 1',
      [req.usuario.empresa_id]
    );
    if (!e) return next(require('../../utils/AppError')('Empresa no encontrada', 404));
    const hoy = new Date();
    const vence = e.suscripcion_vigente_hasta ? new Date(e.suscripcion_vigente_hasta) : null;
    const limite = vence ? new Date(vence) : null;
    if (limite) limite.setDate(limite.getDate() + 3);
    const activa = !vence || limite >= hoy;
    const diasRestantes = vence ? Math.ceil((vence - hoy) / 86400000) : null;
    res.json({ success: true, data: { activa, plan: e.plan, vigente_hasta: e.suscripcion_vigente_hasta, dias_restantes: diasRestantes } });
  } catch (err) { next(err); }
});

// GET /api/empresas/me — admin_empresa ve su propia empresa (campos completos)
// Debe ir ANTES de /:id para que Express no interprete "me" como un ID.
router.get('/me', verificarToken, verificarRol(SOLO_ADMIN), ctrl.miEmpresa);

// PATCH /api/empresas/me — admin_empresa actualiza su empresa
router.patch(
  '/me',
  verificarToken,
  verificarRol(SOLO_ADMIN),
  [
    body('nombre').optional().isString().trim().notEmpty().withMessage('nombre no puede ir vacío'),
    body('nit').optional({ values: 'falsy' }).isString().trim(),
    body('ciudad').optional({ values: 'falsy' }).isString().trim(),
    body('descripcion').optional({ values: 'falsy' }).isString().trim(),
    body('actividad').optional({ values: 'falsy' }).isString().trim(),
    body('logo_url').optional({ values: 'falsy' }).isURL().withMessage('logo_url debe ser una URL válida'),
    body('telefono').optional({ values: 'falsy' }).isString().trim().isLength({ max: 30 }),
    body('email_empresa').optional({ values: 'falsy' }).isEmail().withMessage('email_empresa debe ser un email válido')
      .customSanitizer(v => v.trim().toLowerCase()),
    body('direccion').optional({ values: 'falsy' }).isString().trim().isLength({ max: 300 }),
    body('acepta_postulaciones').optional().isBoolean().withMessage('acepta_postulaciones debe ser booleano'),
    body('tipo_liquidacion').optional().isIn(['mensual', 'quincenal', 'semanal']).withMessage('tipo_liquidacion inválido'),
  ],
  validar,
  ctrl.actualizarMiEmpresa
);

// GET /api/empresas/:id — detalle público
router.get(
  '/:id',
  verificarToken,
  verificarRol(PUEDEN_VER_DIRECTORIO),
  [param('id').isInt({ min: 1 }).toInt().withMessage('id de empresa inválido')],
  validar,
  ctrl.detalle
);

module.exports = router;
