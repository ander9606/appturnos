'use strict';

const express = require('express');
const rateLimit = require('express-rate-limit');
const { query } = require('express-validator');

const { validar } = require('../../middleware/validator');
const { verificarToken } = require('../../middleware/authMiddleware');
const ctrl = require('./geocoding.controller');

const router = express.Router();

// La cola interna del service ya serializa hacia Nominatim a 1 req/s; esto
// solo evita que un cliente en bucle acumule un backlog enorme en esa cola.
const geocodingLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Demasiadas búsquedas de ubicación, espera un momento' },
});

router.use(verificarToken, geocodingLimiter);

router.get(
  '/buscar',
  [query('q').trim().isLength({ min: 3 }).withMessage('q debe tener al menos 3 caracteres')],
  validar,
  ctrl.buscar
);

router.get(
  '/reverse',
  [
    query('lat').isFloat({ min: -90, max: 90 }).withMessage('lat inválida'),
    query('lon').isFloat({ min: -180, max: 180 }).withMessage('lon inválida'),
  ],
  validar,
  ctrl.reverse
);

module.exports = router;
