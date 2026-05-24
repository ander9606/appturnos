'use strict';

const express = require('express');
const { body, param } = require('express-validator');

const { validar } = require('../../../middleware/validator');
const { verificarToken } = require('../../../middleware/authMiddleware');
const { listProviders } = require('./providers');
const ctrl = require('./oauth.controller');

const router = express.Router();

const PROVIDERS_VALIDOS = listProviders();
const providerParam = param('provider')
  .isIn(PROVIDERS_VALIDOS)
  .withMessage(`provider debe ser uno de: ${PROVIDERS_VALIDOS.join(', ')}`);

// POST /api/auth/oauth/:provider — login/registro con un provider OAuth
router.post(
  '/:provider',
  [providerParam, body('token').isString().notEmpty().withMessage('token requerido')],
  validar,
  ctrl.loginConProvider
);

// GET /api/auth/oauth/vinculos — lista mis providers vinculados (autenticado)
router.get('/vinculos', verificarToken, ctrl.vinculos);

// DELETE /api/auth/oauth/:provider — desvincular un provider (autenticado)
router.delete(
  '/:provider',
  verificarToken,
  [providerParam],
  validar,
  ctrl.desvincular
);

module.exports = router;
