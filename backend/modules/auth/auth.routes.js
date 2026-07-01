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

// GET /api/auth/verificar-cedula?cedula=xxx — endpoint público, sin auth
router.get('/verificar-cedula', ctrl.verificarCedula);

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

// POST /api/auth/registro-empresa — registro público de empresa nueva + admin_empresa.
router.post(
  '/registro-empresa',
  [
    body('nombre_empresa').isString().trim().notEmpty().withMessage('Nombre de empresa requerido'),
    body('nit').optional({ values: 'falsy' }).isString().trim(),
    body('descripcion').optional({ values: 'falsy' }).isString().trim().isLength({ max: 500 }),
    body('actividad').optional({ values: 'falsy' }).isString().trim().isLength({ max: 200 }),
    body('telefono').optional({ values: 'falsy' }).isString().trim().isLength({ max: 30 }),
    body('email_empresa').optional({ values: 'falsy' }).isEmail().withMessage('Email de empresa inválido')
      .customSanitizer(v => v.trim().toLowerCase()),
    body('direccion').optional({ values: 'falsy' }).isString().trim().isLength({ max: 300 }),
    body('ciudad').optional({ values: 'falsy' }).isString().trim().isLength({ max: 100 }),
    body('nombre').isString().trim().notEmpty().withMessage('Nombre requerido'),
    body('apellido').optional().isString().trim(),
    emailSanitizado,
    body('password')
      .isString()
      .isLength({ min: 8 })
      .withMessage('La contraseña debe tener al menos 8 caracteres'),
    body('email_token').isString().notEmpty().withMessage('Token de verificación de email requerido'),
    body('telefono_token').optional().isString(),
  ],
  validar,
  ctrl.registrarEmpresa
);

// POST /api/auth/enviar-otp — envía código OTP por email o SMS
router.post(
  '/enviar-otp',
  [
    body('tipo').isIn(['email', 'telefono']).withMessage('tipo debe ser "email" o "telefono"'),
    body('destino').isString().trim().notEmpty().withMessage('destino requerido'),
  ],
  validar,
  ctrl.enviarOtp,
);

// POST /api/auth/verificar-otp — verifica OTP y devuelve token de verificación
router.post(
  '/verificar-otp',
  [
    body('tipo').isIn(['email', 'telefono']).withMessage('tipo debe ser "email" o "telefono"'),
    body('destino').isString().trim().notEmpty().withMessage('destino requerido'),
    body('codigo').isString().isLength({ min: 6, max: 6 }).withMessage('codigo debe tener 6 dígitos'),
  ],
  validar,
  ctrl.verificarOtp,
);

// POST /api/auth/registro — registro libre para trabajador_turnos (marketplace).
// No requiere cédula ni empresa preexistente.
router.post(
  '/registro',
  [
    body('nombre').isString().trim().notEmpty().withMessage('Nombre requerido'),
    body('apellido').optional().isString().trim(),
    emailSanitizado,
    body('telefono').isString().trim().notEmpty().withMessage('Teléfono requerido'),
    body('password')
      .isString()
      .isLength({ min: 8 })
      .withMessage('La contraseña debe tener al menos 8 caracteres'),
    body('email_token').isString().notEmpty().withMessage('Token de verificación de email requerido'),
    body('telefono_token').isString().notEmpty().withMessage('Token de verificación de teléfono requerido'),
  ],
  validar,
  ctrl.registrar
);

// PATCH /api/auth/me — actualizar nombre / apellido / email / telefono
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
    body('telefono').optional().isString().trim().isLength({ min: 7, max: 20 }).withMessage('Teléfono inválido'),
    body('telefono_token').optional().isString(),
  ],
  validar,
  ctrl.actualizarPerfil
);

// PATCH /api/auth/me/foto — actualizar foto de perfil
router.patch(
  '/me/foto',
  verificarToken,
  [body('foto_b64').optional({ values: 'falsy' }).isString().withMessage('foto_b64 debe ser string base64')],
  validar,
  ctrl.actualizarFoto
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

// GET /api/auth/gestores — lista gestores de la empresa
router.get('/gestores', verificarToken, verificarRol([ROLES.ADMIN_EMPRESA]), ctrl.listarGestores);

// PATCH /api/auth/gestores/:id/activo — activar/desactivar un gestor
router.patch(
  '/gestores/:id/activo',
  verificarToken,
  verificarRol([ROLES.ADMIN_EMPRESA]),
  [body('activo').isBoolean().withMessage('activo debe ser booleano')],
  validar,
  ctrl.setActivoGestor
);

// PATCH /api/auth/me/terminos — aceptar términos y condiciones
router.patch('/me/terminos', verificarToken, ctrl.aceptarTerminos);

// POST /api/auth/reset-password — restablecer contraseña vía OTP de email (sin sesión)
router.post(
  '/reset-password',
  [
    emailSanitizado,
    body('password')
      .isString()
      .isLength({ min: 8 })
      .withMessage('La contraseña debe tener al menos 8 caracteres'),
    body('email_token').isString().notEmpty().withMessage('Token de verificación de email requerido'),
  ],
  validar,
  ctrl.resetPassword
);

// Sub-router OAuth — POST /api/auth/oauth/:provider, etc.
router.use('/oauth', require('./oauth/oauth.routes'));

module.exports = router;
