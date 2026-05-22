'use strict';

const AsignacionesService = require('./asignaciones.service');

async function listar(req, res) {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));

  const { data, pagination } = await AsignacionesService.listar(req.empresa_id, {
    fecha: req.query.fecha || undefined,
    oferta_id: req.query.oferta_id ? Number(req.query.oferta_id) : undefined,
    trabajador_id: req.query.trabajador_id ? Number(req.query.trabajador_id) : undefined,
    page,
    limit,
  });
  res.json({ success: true, data, pagination });
}

async function confirmar(req, res) {
  const data = await AsignacionesService.confirmar(req.empresa_id, Number(req.params.id));
  res.json({ success: true, data, message: 'Asignación confirmada' });
}

async function ingreso(req, res) {
  const data = await AsignacionesService.marcarIngreso(
    req.empresa_id,
    Number(req.params.id),
    req.usuario.sub,
    req.body
  );
  res.json({ success: true, data, message: 'Ingreso registrado' });
}

async function egreso(req, res) {
  const data = await AsignacionesService.marcarEgreso(
    req.empresa_id,
    Number(req.params.id),
    req.usuario.sub,
    req.body
  );
  res.json({ success: true, data, message: 'Egreso registrado' });
}

async function misTurnos(req, res) {
  const data = await AsignacionesService.misTurnos(req.empresa_id, req.usuario.sub);
  res.json({ success: true, data, message: 'Mis turnos y postulaciones' });
}

module.exports = { listar, confirmar, ingreso, egreso, misTurnos };
