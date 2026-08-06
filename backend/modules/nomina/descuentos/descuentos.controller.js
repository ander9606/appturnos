'use strict';

const DescuentosService = require('./descuentos.service');

async function crear(req, res) {
  const data = await DescuentosService.crear(req.empresa_id, req.usuario.sub, {
    trabajadorId: req.body.trabajador_id,
    periodoId: req.body.periodo_id,
    tipo: req.body.tipo,
    motivo: req.body.motivo,
    monto: req.body.monto,
  });
  res.status(201).json({ success: true, data, message: 'Descuento registrado' });
}

async function listar(req, res) {
  const data = await DescuentosService.listar(req.empresa_id, req.usuario, {
    periodoId: req.query.periodo_id ? Number(req.query.periodo_id) : undefined,
    estado: req.query.estado,
  });
  res.json({ success: true, data });
}

async function aceptar(req, res) {
  const data = await DescuentosService.responder(req.empresa_id, req.usuario, Number(req.params.id), 'aceptado');
  res.json({ success: true, data, message: 'Descuento aceptado' });
}

async function rechazar(req, res) {
  const data = await DescuentosService.responder(req.empresa_id, req.usuario, Number(req.params.id), 'rechazado');
  res.json({ success: true, data, message: 'Descuento rechazado' });
}

async function eliminar(req, res) {
  await DescuentosService.eliminar(req.empresa_id, Number(req.params.id));
  res.json({ success: true, data: null, message: 'Descuento eliminado' });
}

module.exports = { crear, listar, aceptar, rechazar, eliminar };
