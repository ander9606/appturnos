'use strict';

const express = require('express');
const { body } = require('express-validator');

const { validar } = require('../../middleware/validator');
const { verificarToken, verificarRol } = require('../../middleware/authMiddleware');
const { ROLES } = require('../../config/constants');
const ctrl = require('./auth.controller');

const router = express.Router();

const emailSanitizado = body('email')
  .isEmail()
  .withMessage('Email inválido')
  .bail()
  .customSanitizer((v) => v.trim().toLowerCase());

// POST /api/auth/login
router.post(
  '/login',
  [emailSanitizado, body('password').notEmpty().withMessage('Contraseña requerida')],
  validar,
  ctrl.login
);

// POST /api/auth/refresh
router.post(
  '/refresh',
  [body('refresh_token').notEmpty().withMessage('refresh_token requerido')],
  validar,
  ctrl.refresh
);

// POST /api/auth/logout
router.post(
  '/logout',
  [body('refresh_token').notEmpty().withMessage('refresh_token requerido')],
  validar,
  ctrl.logout
);

// GET /api/auth/me
router.get('/me', verificarToken, ctrl.me);

// POST /api/auth/activar-cuenta
router.post(
  '/activar-cuenta',
  [
    body('cedula').isString().trim().notEmpty().withMessage('Cédula requerida'),
    emailSanitizado,
    body('password')
      .isString()
      .isLength({ min: 8 })
      .withMessage('La contraseña debe tener al menos 8 caracteres'),
  ],
  validar,
  ctrl.activarCuenta
);

// POST /api/auth/registro — registro libre para trabajador_turnos (marketplace).
// No requiere cédula ni empresa preexistente.
router.post(
  '/registro',
  [
    body('nombre').isString().trim().notEmpty().withMessage('Nombre requerido'),
    body('apellido').optional().isString().trim(),
    emailSanitizado,
    body('password')
      .isString()
      .isLength({ min: 8 })
      .withMessage('La contraseña debe tener al menos 8 caracteres'),
  ],
  validar,
  ctrl.registrar
);

// PATCH /api/auth/me — actualizar nombre / apellido / email
router.patch(
  '/me',
  verificarToken,
  [
    body('nombre').optional().isString().trim().notEmpty().withMessage('Nombre inválido'),
    body('apellido').optional().isString().trim(),
    body('email')
      .optional()
      .isEmail().withMessage('Email inválido').bail()
      .customSanitizer((v) => v.trim().toLowerCase()),
  ],
  validar,
  ctrl.actualizarPerfil
);

// PATCH /api/auth/me/password — cambiar contraseña
router.patch(
  '/me/password',
  verificarToken,
  [
    body('password_actual').notEmpty().withMessage('Contraseña actual requerida'),
    body('password_nueva')
      .isString()
      .isLength({ min: 8 })
      .withMessage('La nueva contraseña debe tener al menos 8 caracteres'),
  ],
  validar,
  ctrl.cambiarPassword
);

// POST /api/auth/crear-gestor — admin_empresa crea un usuario gestor en su empresa
router.post(
  '/crear-gestor',
  verificarToken,
  verificarRol([ROLES.ADMIN_EMPRESA]),
  [
    body('nombre').isString().trim().notEmpty().withMessage('Nombre requerido'),
    body('apellido').optional().isString().trim(),
    emailSanitizado,
    body('rol')
      .isIn(['jefe_turnos', 'jefe_nomina', 'nomina'])
      .withMessage('Rol inválido. Usa: jefe_turnos, jefe_nomina o nomina'),
  ],
  validar,
  ctrl.crearGestor
);

// Sub-router OAuth — POST /api/auth/oauth/:provider, etc.
router.use('/oauth', require('./oauth/oauth.routes'));

module.exports = router;
