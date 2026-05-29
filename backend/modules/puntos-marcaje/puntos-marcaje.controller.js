'use strict';

const PuntosMarcajeService = require('./puntos-marcaje.service');

async function listar(req, res) {
  const data = await PuntosMarcajeService.listar(req.empresa_id);
  res.json({ success: true, data, message: 'Puntos de marcaje' });
}

async function crear(req, res) {
  const { nombre, descripcion, latitud, longitud, radio_metros, tipo } = req.body;
  const data = await PuntosMarcajeService.crear(req.empresa_id, {
    nombre, descripcion, latitud, longitud, radio_metros, tipo,
  });
  res.status(201).json({ success: true, data, message: 'Punto de marcaje creado' });
}

async function actualizar(req, res) {
  const data = await PuntosMarcajeService.actualizar(req.empresa_id, req.params.id, req.body);
  res.json({ success: true, data, message: 'Punto actualizado' });
}

async function eliminar(req, res) {
  await PuntosMarcajeService.eliminar(req.empresa_id, req.params.id);
  res.json({ success: true, data: null, message: 'Punto eliminado' });
}

module.exports = { listar, crear, actualizar, eliminar };
