'use strict';

const AusenciasService = require('./ausencias.service');

async function listar(req, res) {
  const page  = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, parseInt(req.query.limit, 10) || 20);
  const { data, total } = await AusenciasService.listar(
    req.empresa_id, req.usuario,
    { estado: req.query.estado || undefined, page, limit }
  );
  res.json({ success: true, data: { data, pagination: { page, limit, total } } });
}

async function crear(req, res) {
  const data = await AusenciasService.crear(req.empresa_id, req.usuario, req.body);
  res.status(201).json({ success: true, data, message: 'Solicitud de ausencia creada' });
}

async function actualizarEstado(req, res) {
  const data = await AusenciasService.actualizarEstado(
    req.empresa_id, Number(req.params.id), req.body.estado, req.usuario.sub
  );
  res.json({ success: true, data, message: `Ausencia ${req.body.estado}` });
}

async function contarPendientes(req, res) {
  const total = await AusenciasService.contarPendientes(req.empresa_id);
  res.json({ success: true, data: { total } });
}

module.exports = { listar, crear, actualizarEstado, contarPendientes };