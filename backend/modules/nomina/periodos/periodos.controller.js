'use strict';

const PeriodosService = require('./periodos.service');

async function listar(req, res) {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const { data, pagination } = await PeriodosService.listar(req.empresa_id, {
    estado: req.query.estado || undefined,
    page,
    limit,
  });
  res.json({ success: true, data: { data, pagination } });
}

async function crear(req, res) {
  const data = await PeriodosService.crear(req.empresa_id, req.body);
  res.status(201).json({ success: true, data, message: 'Período creado' });
}

async function cerrar(req, res) {
  const data = await PeriodosService.cerrar(req.empresa_id, Number(req.params.id), req.usuario.sub);
  res.json({ success: true, data, message: 'Período cerrado' });
}

async function liquidar(req, res) {
  const data = await PeriodosService.liquidar(req.empresa_id, Number(req.params.id));
  res.json({ success: true, data, message: 'Período marcado como liquidado' });
}

module.exports = { listar, crear, cerrar, liquidar };
