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
  res.json({ success: true, data, pagination });
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

module.exports = { listar, obtener, crear, actualizar, eliminar };
