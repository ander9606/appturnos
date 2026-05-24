'use strict';

const express = require('express');
const { body } = require('express-validator');

const { validar } = require('../../middleware/validator');
const { verificarToken } = require('../../middleware/authMiddleware');
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

// Sub-router OAuth — POST /api/auth/oauth/:provider, etc.
router.use('/oauth', require('./oauth/oauth.routes'));

module.exports = router;
