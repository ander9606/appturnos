'use strict';

const express = require('express');
const { query, param } = require('express-validator');

const { validar } = require('../../middleware/validator');
const { verificarToken, verificarRol } = require('../../middleware/authMiddleware');
const { ROLES } = require('../../config/constants');
const ctrl = require('./empresas.controller');

const router = express.Router();

// Solo trabajadores-turnos usan el directorio (los jefes/admins
// ya conocen su empresa directamente).
const SOLO_TURNOS = [ROLES.TRABAJADOR_TURNOS];

// GET /api/empresas/directorio — directorio público de empleadores
router.get(
  '/directorio',
  verificarToken,
  verificarRol(SOLO_TURNOS),
  [
    query('busqueda').optional().isString().trim(),
    query('ciudad').optional().isString().trim(),
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 50 }).toInt(),
  ],
  validar,
  ctrl.directorio
);

// GET /api/empresas/:id — detalle público de una empresa
router.get(
  '/:id',
  verificarToken,
  verificarRol(SOLO_TURNOS),
  [param('id').isInt({ min: 1 }).toInt().withMessage('id de empresa inválido')],
  validar,
  ctrl.detalle
);

module.exports = router;
