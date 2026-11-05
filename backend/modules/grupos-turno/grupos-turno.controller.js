'use strict';

const GruposTurnoService = require('./grupos-turno.service');

async function listar(req, res) {
  const data = await GruposTurnoService.listar(req.empresa_id, req.query.estado);
  res.json({ success: true, data, message: 'Grupos de turnos' });
}

async function obtener(req, res) {
  const data = await GruposTurnoService.obtener(req.empresa_id, req.params.id);
  res.json({ success: true, data, message: 'Detalle del grupo' });
}

async function crear(req, res) {
  const { nombre, descripcion, lugar, latitud, longitud } = req.body;
  const data = await GruposTurnoService.crear(
    req.empresa_id, { nombre, descripcion, lugar, latitud, longitud }, req.usuario.sub
  );
  res.status(201).json({ success: true, data, message: 'Grupo creado' });
}

async function actualizar(req, res) {
  const { nombre, descripcion, lugar, latitud, longitud } = req.body;
  const data = await GruposTurnoService.actualizar(
    req.empresa_id, req.params.id, { nombre, descripcion, lugar, latitud, longitud }
  );
  res.json({ success: true, data, message: 'Grupo actualizado' });
}

async function cerrar(req, res) {
  const data = await GruposTurnoService.cerrar(req.empresa_id, req.params.id);
  res.json({ success: true, data, message: 'Grupo cerrado' });
}

async function reabrir(req, res) {
  const data = await GruposTurnoService.reabrir(req.empresa_id, req.params.id);
  res.json({ success: true, data, message: 'Grupo reabierto' });
}

module.exports = { listar, obtener, crear, actualizar, cerrar, reabrir };
