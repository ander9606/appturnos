'use strict';

const express = require('express');
const { query, param } = require('express-validator');

const { validar } = require('../../middleware/validator');
const { verificarToken, verificarRol } = require('../../middleware/authMiddleware');
const { ROLES } = require('../../config/constants');
const ctrl = require('./empresas.controller');

const router = express.Router();

// Trabajadores ven el directorio para postularse; admins/jefes lo ven
// para seleccionar empresas al crear perfiles de trabajadores.
const PUEDEN_VER_DIRECTORIO = [
  ROLES.TRABAJADOR_TURNOS,
  ROLES.ADMIN_EMPRESA,
  ROLES.JEFE_TURNOS,
];

// GET /api/empresas/directorio — directorio público de empleadores
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

// GET /api/empresas/:id — detalle público de una empresa
router.get(
  '/:id',
  verificarToken,
  verificarRol(PUEDEN_VER_DIRECTORIO),
  [param('id').isInt({ min: 1 }).toInt().withMessage('id de empresa inválido')],
  validar,
  ctrl.detalle
);

module.exports = router;
