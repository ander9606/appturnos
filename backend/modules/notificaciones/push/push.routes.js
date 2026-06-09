'use strict';

const express = require('express');
const { body } = require('express-validator');

const { validar } = require('../../../middleware/validator');
const { verificarToken } = require('../../../middleware/authMiddleware');
const ctrl = require('./push.controller');

const router = express.Router();

router.use(verificarToken);

// GET /api/push/clave-publica  → clave VAPID para suscribirse desde el navegador
router.get('/clave-publica', ctrl.clavePublica);

// POST /api/push/suscripcion  → registra la suscripción push del navegador
router.post(
  '/suscripcion',
  [
    body('endpoint').notEmpty().withMessage('endpoint requerido'),
    body('keys.p256dh').notEmpty().withMessage('keys.p256dh requerido'),
    body('keys.auth').notEmpty().withMessage('keys.auth requerido'),
  ],
  validar,
  ctrl.suscribir
);

// DELETE /api/push/suscripcion  → elimina la suscripción push
router.delete(
  '/suscripcion',
  [body('endpoint').notEmpty().withMessage('endpoint requerido')],
  validar,
  ctrl.desuscribir
);

// POST /api/push/expo-token  → registra un Expo push token (app móvil)
router.post(
  '/expo-token',
  [body('token').notEmpty().withMessage('token requerido')],
  validar,
  ctrl.registrarExpoToken
);

// DELETE /api/push/expo-token  → elimina el Expo push token
router.delete(
  '/expo-token',
  [body('token').notEmpty().withMessage('token requerido')],
  validar,
  ctrl.eliminarExpoToken
);

module.exports = router;
