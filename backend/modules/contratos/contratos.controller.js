'use strict';

const ContratosService = require('./contratos.service');
const { generarContratoPdf } = require('../../utils/contratoPdf');

async function obtener(req, res) {
  const data = await ContratosService.obtener(req.empresa_id, Number(req.params.id), req.usuario);
  res.json({ success: true, data, message: 'Detalle del contrato' });
}

async function firmar(req, res) {
  const data = await ContratosService.firmar(
    req.empresa_id,
    Number(req.params.id),
    req.usuario,
    req.body.firma_b64
  );
  res.json({ success: true, data, message: 'Contrato firmado' });
}

async function pdf(req, res) {
  const contrato = await ContratosService.obtener(
    req.empresa_id,
    Number(req.params.id),
    req.usuario
  );
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    `inline; filename="contrato-${contrato.numero_contrato}.pdf"`
  );
  generarContratoPdf(contrato, res);
}

module.exports = { obtener, firmar, pdf };
