'use strict';

const express = require('express');
const { param } = require('express-validator');

const { validar } = require('../../middleware/validator');
const { verificarToken } = require('../../middleware/authMiddleware');
const ctrl = require('./notificaciones.controller');

const router = express.Router();

// Cada usuario gestiona sus propias notificaciones; basta con autenticación.
router.use(verificarToken);

// GET /api/notificaciones
router.get('/', ctrl.listar);

// POST /api/notificaciones/leer-todas
router.post('/leer-todas', ctrl.leerTodas);

// POST /api/notificaciones/:id/leer
router.post(
  '/:id/leer',
  [param('id').isInt({ min: 1 }).withMessage('id inválido')],
  validar,
  ctrl.leer
);

module.exports = router;
