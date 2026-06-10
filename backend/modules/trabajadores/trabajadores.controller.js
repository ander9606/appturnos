'use strict';

const TrabajadoresService = require('./trabajadores.service');

/**
 * Controladores HTTP de trabajadores.
 * El empresa_id proviene del JWT (req.empresa_id), nunca del cliente.
 */

async function listar(req, res) {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const tipo = req.query.tipo || undefined;

  let activo;
  if (req.query.activo !== undefined) {
    activo = req.query.activo === 'true' || req.query.activo === '1';
  }

  const { data, pagination } = await TrabajadoresService.listar(req.empresa_id, {
    tipo,
    activo,
    page,
    limit,
  });
  res.json({ success: true, data: { data, pagination } });
}

async function obtener(req, res) {
  const data = await TrabajadoresService.obtener(req.empresa_id, Number(req.params.id));
  res.json({ success: true, data, message: 'Detalle del trabajador' });
}

async function crear(req, res) {
  const data = await TrabajadoresService.crear(req.empresa_id, req.body);
  res.status(201).json({ success: true, data, message: 'Trabajador creado' });
}

async function actualizar(req, res) {
  const data = await TrabajadoresService.actualizar(
    req.empresa_id,
    Number(req.params.id),
    req.body
  );
  res.json({ success: true, data, message: 'Trabajador actualizado' });
}

async function eliminar(req, res) {
  await TrabajadoresService.eliminar(req.empresa_id, Number(req.params.id));
  res.json({ success: true, data: null, message: 'Trabajador desactivado' });
}

async function buscarPorCedula(req, res) {
  // Only returns marketplace workers (empresa_id IS NULL) — never exposes other empresas' data.
  const data = await TrabajadoresService.buscarPorCedula(req.query.cedula?.trim());
  // Return minimal fields needed for the invite flow
  const { id, nombre, apellido, cedula, tipo_documento, cargo, ranking } = data;
  res.json({ success: true, data: { id, nombre, apellido, cedula, tipo_documento, cargo, ranking } });
}

async function obtenerMe(req, res) {
  const data = await TrabajadoresService.me(req.usuario.sub);
  res.json({ success: true, data, message: 'Mi perfil laboral' });
}

async function actualizarMe(req, res) {
  const data = await TrabajadoresService.actualizarMe(req.usuario.sub, req.body);
  res.json({ success: true, data, message: 'Perfil actualizado' });
}

async function crearExperiencia(req, res) {
  const data = await TrabajadoresService.crearExperiencia(req.usuario.sub, req.body);
  res.status(201).json({ success: true, data });
}

async function eliminarExperiencia(req, res) {
  await TrabajadoresService.eliminarExperiencia(req.usuario.sub, Number(req.params.expId));
  res.json({ success: true, data: null });
}

async function crearDiploma(req, res) {
  const data = await TrabajadoresService.crearDiploma(req.usuario.sub, req.body);
  res.status(201).json({ success: true, data });
}

async function eliminarDiploma(req, res) {
  await TrabajadoresService.eliminarDiploma(req.usuario.sub, Number(req.params.dipId));
  res.json({ success: true, data: null });
}

module.exports = {
  listar, obtener, buscarPorCedula, crear, actualizar, eliminar,
  obtenerMe, actualizarMe,
  crearExperiencia, eliminarExperiencia,
  crearDiploma, eliminarDiploma,
};
