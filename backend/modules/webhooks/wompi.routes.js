'use strict';

const express = require('express');
const WompiService = require('./wompi.service');

const router = express.Router();

// POST /api/webhooks/wompi — sin autenticacion, Wompi firma con HMAC
router.post('/', async (req, res) => {
  try {
    const resultado = await WompiService.procesarEvento(req.body);
    // Wompi espera 200 siempre; errores de negocio no deben generar reintentos
    res.json({ ok: resultado.ok });
  } catch (err) {
    res.status(500).json({ ok: false });
  }
});

module.exports = router;
