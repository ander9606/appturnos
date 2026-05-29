'use strict';

const CargosService = require('./cargos.service');

/** GET /api/cargos — catálogo visible (sistema + custom de mi empresa). */
async function listar(req, res) {
  const empresaId = req.empresa_id;
  const data = await CargosService.listarParaEmpresa(empresaId);
  res.json({ success: true, data, message: 'Catálogo de cargos' });
}

/** POST /api/cargos — crear cargo custom de mi empresa. */
async function crear(req, res) {
  const empresaId = req.empresa_id;
  const { codigo, nombre, descripcion, tipo_geofence, punto_marcaje_id } = req.body;
  const data = await CargosService.crearParaEmpresa(empresaId, {
    codigo,
    nombre,
    descripcion,
    tipo_geofence,
    punto_marcaje_id,
  });
  res.status(201).json({ success: true, data, message: 'Cargo creado' });
}

/** PATCH /api/cargos/:id — editar nombre/descripcion/activo/geofence de un cargo custom. */
async function actualizar(req, res) {
  const empresaId = req.empresa_id;
  const cargoId = Number(req.params.id);
  const { nombre, descripcion, activo, tipo_geofence, punto_marcaje_id } = req.body;
  const data = await CargosService.actualizar(empresaId, cargoId, {
    nombre,
    descripcion,
    activo,
    tipo_geofence,
    punto_marcaje_id,
  });
  res.json({ success: true, data, message: 'Cargo actualizado' });
}

/** DELETE /api/cargos/:id — borra (o desactiva si está en uso) un cargo custom. */
async function eliminar(req, res) {
  const empresaId = req.empresa_id;
  const cargoId = Number(req.params.id);
  const data = await CargosService.eliminar(empresaId, cargoId);
  const message = data.desactivado
    ? `Cargo desactivado (estaba en uso por ${data.usos} trabajadores)`
    : 'Cargo eliminado';
  res.json({ success: true, data, message });
}

// -------- Asignaciones (montadas desde trabajador-empresa.routes) --------

/** GET /api/trabajador-empresa/:id/cargos — cargos del trabajador en mi empresa. */
async function listarCargosDeVinculo(req, res) {
  const empresaId = req.empresa_id;
  const vinculoId = Number(req.params.id);
  const data = await CargosService.listarCargosDeVinculo(empresaId, vinculoId);
  res.json({ success: true, data, message: 'Cargos del trabajador' });
}

/** POST /api/trabajador-empresa/:id/cargos — asignar un cargo al trabajador. */
async function asignarCargoAVinculo(req, res) {
  const empresaId = req.empresa_id;
  const vinculoId = Number(req.params.id);
  const cargoId = Number(req.body.cargo_id);
  const asignadoPor = req.usuario.sub;
  const data = await CargosService.asignarCargo(
    empresaId,
    vinculoId,
    cargoId,
    asignadoPor
  );
  res.status(201).json({ success: true, data, message: 'Cargo asignado' });
}

/** DELETE /api/trabajador-empresa/:id/cargos/:cargoId — quitar un cargo. */
async function desasignarCargoDeVinculo(req, res) {
  const empresaId = req.empresa_id;
  const vinculoId = Number(req.params.id);
  const cargoId = Number(req.params.cargoId);
  const data = await CargosService.desasignarCargo(empresaId, vinculoId, cargoId);
  res.json({ success: true, data, message: 'Cargo desasignado' });
}

module.exports = {
  listar,
  crear,
  actualizar,
  eliminar,
  listarCargosDeVinculo,
  asignarCargoAVinculo,
  desasignarCargoDeVinculo,
};
