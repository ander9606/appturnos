'use strict';

const PuestosService = require('./puestos.service');

async function listar(req, res) {
  const data = await PuestosService.listar(req.empresa_id, Number(req.params.id));
  res.json({ success: true, data, message: 'Puestos de la oferta' });
}

async function agregar(req, res) {
  const data = await PuestosService.agregar(
    req.empresa_id,
    Number(req.params.id),
    req.body
  );
  res.status(201).json({ success: true, data, message: 'Puesto agregado' });
}

async function actualizar(req, res) {
  const data = await PuestosService.actualizar(
    req.empresa_id,
    Number(req.params.id),
    Number(req.params.puestoId),
    req.body
  );
  res.json({ success: true, data, message: 'Puesto actualizado' });
}

async function eliminar(req, res) {
  await PuestosService.eliminar(
    req.empresa_id,
    Number(req.params.id),
    Number(req.params.puestoId)
  );
  res.json({ success: true, data: null, message: 'Puesto eliminado' });
}

module.exports = { listar, agregar, actualizar, eliminar };
