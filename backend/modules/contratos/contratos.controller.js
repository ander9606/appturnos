'use strict';

const ContratosService = require('./contratos.service');
const { generarContratoPdf } = require('../../utils/contratoPdf');

async function listar(req, res) {
  const data = await ContratosService.listarMisContratos(req.empresa_id, req.usuario);
  res.json({ success: true, data, message: 'Mis contratos' });
}

async function obtenerPorAsignacion(req, res) {
  const asignacionId = Number(req.params.asignacionId);
  let data;
  try {
    data = await ContratosService.obtenerPorAsignacion(
      req.empresa_id, asignacionId, req.usuario
    );
  } catch (err) {
    // Si el contrato no existe (404), intentar generarlo automáticamente
    if (err.statusCode === 404 && err.message === 'Contrato no encontrado') {
      // Fallback: generar contrato desde datos de asignación
      data = await ContratosService.generarSiNoExiste(
        req.empresa_id, asignacionId, req.usuario
      );
    } else {
      throw err;
    }
  }
  res.json({ success: true, data, message: 'Contrato de asignación' });
}

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

async function pdfPorAsignacion(req, res) {
  const asignacionId = Number(req.params.asignacionId);
  let contrato;
  try {
    contrato = await ContratosService.obtenerPorAsignacion(req.empresa_id, asignacionId, req.usuario);
  } catch (err) {
    // Mismo fallback que obtenerPorAsignacion: si el contrato aún no existe,
    // generarlo on-demand en vez de fallar la descarga con 404.
    if (err.statusCode === 404 && err.message === 'Contrato no encontrado') {
      contrato = await ContratosService.generarSiNoExiste(req.empresa_id, asignacionId, req.usuario);
    } else {
      throw err;
    }
  }
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    `inline; filename="contrato-${contrato.numero_contrato}.pdf"`
  );
  generarContratoPdf(contrato, res);
}

async function listarSinFirmar(req, res) {
  const data = await ContratosService.listarSinFirmar(req.empresa_id, req.usuario);
  res.json({ success: true, data, message: 'Contratos sin firmar' });
}

module.exports = { listar, obtenerPorAsignacion, obtener, firmar, pdf, pdfPorAsignacion, listarSinFirmar };
