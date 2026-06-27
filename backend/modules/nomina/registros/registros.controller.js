'use strict';

const RegistrosService = require('./registros.service');

async function listar(req, res) {
  const page  = Math.min(10000, Math.max(1, parseInt(req.query.page, 10) || 1));
  const limit = Math.min(500,   Math.max(1, parseInt(req.query.limit, 10) || 20));

  const { data, pagination } = await RegistrosService.listar(req.empresa_id, req.usuario, {
    periodo_id:    req.query.periodo_id    ? Number(req.query.periodo_id)    : undefined,
    trabajador_id: req.query.trabajador_id ? Number(req.query.trabajador_id) : undefined,
    fecha:         req.query.fecha         || undefined,
    fecha_desde:   req.query.fecha_desde   || undefined,
    fecha_hasta:   req.query.fecha_hasta   || undefined,
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

async function obtenerMiPerfil(req, res) {
  const data = await RegistrosService.obtenerMiPerfil(req.empresa_id, req.usuario.sub);
  res.json({ success: true, data });
}

async function marcarEntrada(req, res) {
  const data = await RegistrosService.marcarEntrada(req.empresa_id, req.usuario, req.body);
  res.status(201).json({ success: true, data, message: 'Entrada registrada' });
}

async function marcarSalida(req, res) {
  const data = await RegistrosService.marcarSalida(
    req.empresa_id,
    req.usuario,
    Number(req.params.id),
    req.body
  );
  res.json({ success: true, data, message: 'Salida registrada' });
}

async function solicitarReingreso(req, res) {
  const data = await RegistrosService.solicitarReingreso(req.empresa_id, req.usuario, req.body);
  res.status(201).json({ success: true, data, message: 'Solicitud de reingreso enviada al gestor' });
}

async function listarReingresosPendientes(req, res) {
  const data = await RegistrosService.listarReingresosPendientes(req.empresa_id);
  res.json({ success: true, data });
}

async function aprobarReingreso(req, res) {
  await RegistrosService.aprobarReingreso(req.empresa_id, req.usuario.sub, Number(req.params.id));
  res.json({ success: true, data: null, message: 'Reingreso aprobado' });
}

async function rechazarReingreso(req, res) {
  await RegistrosService.rechazarReingreso(req.empresa_id, req.usuario.sub, Number(req.params.id));
  res.json({ success: true, data: null, message: 'Reingreso rechazado' });
}

module.exports = {
  listar, crear, corregir, obtenerMiPerfil, marcarEntrada, marcarSalida,
  solicitarReingreso, listarReingresosPendientes, aprobarReingreso, rechazarReingreso,
};
