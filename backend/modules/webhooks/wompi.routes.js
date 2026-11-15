'use strict';

const express = require('express');
const WompiService = require('./wompi.service');
const logger = require('../../utils/logger');

const router = express.Router();

// POST /api/webhooks/wompi — sin autenticacion, Wompi firma con HMAC
router.post('/', async (req, res) => {
  const tx = req.body?.data?.transaction;
  logger.info(`[wompi-webhook] recibido event=${req.body?.event ?? 'desconocido'} transaction=${tx?.id ?? 'sin-id'} status=${tx?.status ?? 'sin-status'}`);
  try {
    const resultado = await WompiService.procesarEvento(req.body);
    // Wompi espera 200 siempre; errores de negocio no deben generar reintentos
    res.json({ ok: resultado.ok });
  } catch (err) {
    logger.error(`[wompi-webhook] fallo al procesar transaction=${tx?.id ?? 'sin-id'}: ${err.message}`);
    res.status(500).json({ ok: false });
  }
});

module.exports = router;
