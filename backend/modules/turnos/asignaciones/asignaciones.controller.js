'use strict';

const AsignacionesService = require('./asignaciones.service');

async function obtener(req, res) {
  const data = await AsignacionesService.obtener(req.empresa_id, Number(req.params.id), req.usuario);
  res.json({ success: true, data });
}

async function listar(req, res) {
  const page = Math.min(10000, Math.max(1, parseInt(req.query.page, 10) || 1));
  const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 20));

  const { data, pagination } = await AsignacionesService.listar(req.empresa_id, {
    fecha: req.query.fecha || undefined,
    oferta_id: req.query.oferta_id ? Number(req.query.oferta_id) : undefined,
    trabajador_id: req.query.trabajador_id ? Number(req.query.trabajador_id) : undefined,
    estado: req.query.estado || undefined,
    page,
    limit,
  });
  res.json({ success: true, data: { data, pagination } });
}

async function confirmar(req, res) {
  const data = await AsignacionesService.confirmar(req.empresa_id, Number(req.params.id));
  res.json({ success: true, data, message: 'Asignación confirmada' });
}

async function cancelar(req, res) {
  const data = await AsignacionesService.cancelar(req.empresa_id, Number(req.params.id));
  res.json({ success: true, data, message: 'Asignación cancelada' });
}

async function rechazar(req, res) {
  const data = await AsignacionesService.rechazar(req.empresa_id, Number(req.params.id));
  res.json({ success: true, data, message: 'Postulación rechazada' });
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

async function noPresentado(req, res) {
  const data = await AsignacionesService.marcarNoPresentado(
    req.empresa_id,
    Number(req.params.id)
  );
  res.json({ success: true, data, message: 'Marcado como no presentado' });
}

async function calificar(req, res) {
  const data = await AsignacionesService.calificar(
    req.empresa_id,
    Number(req.params.id),
    req.usuario,
    req.body
  );
  res.status(201).json({ success: true, data, message: 'Calificación registrada' });
}

async function liquidacion(req, res) {
  const data = await AsignacionesService.liquidacion(req.empresa_id, {
    fecha_inicio: req.query.fecha_inicio || undefined,
    fecha_fin:    req.query.fecha_fin    || undefined,
  });
  res.json({ success: true, data });
}

module.exports = { listar, obtener, confirmar, rechazar, cancelar, ingreso, egreso, misTurnos, noPresentado, calificar, liquidacion };
