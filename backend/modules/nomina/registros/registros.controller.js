'use strict';

const RegistrosService = require('./registros.service');

async function listar(req, res) {
  const page = Math.min(10000, Math.max(1, parseInt(req.query.page, 10) || 1));
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));

  const { data, pagination } = await RegistrosService.listar(req.empresa_id, req.usuario, {
    periodo_id: req.query.periodo_id ? Number(req.query.periodo_id) : undefined,
    trabajador_id: req.query.trabajador_id ? Number(req.query.trabajador_id) : undefined,
    fecha: req.query.fecha || undefined,
    page,
    limit,
  });
  res.json({ success: true, data: { data, pagination } });
}

async function crear(req, res) {
  const data = await RegistrosService.crear(req.empresa_id, req.usuario, req.body);
  res.status(201).json({ success: true, data, message: 'Registro creado' });
}

async function corregir(req, res) {
  const data = await RegistrosService.corregir(
    req.empresa_id,
    req.usuario,
    Number(req.params.id),
    req.body
  );
  res.json({ success: true, data, message: 'Registro corregido' });
}

module.exports = { listar, crear, corregir };
