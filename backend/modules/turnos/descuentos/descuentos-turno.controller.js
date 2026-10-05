'use strict';

const DescuentosTurnoService = require('./descuentos-turno.service');

async function listar(req, res) {
  const data = await DescuentosTurnoService.listarPorAsignacion(
    req.empresa_id, Number(req.params.asignacionId), req.usuario
  );
  res.json({ success: true, data });
}

async function crear(req, res) {
  const data = await DescuentosTurnoService.crear(
    req.empresa_id,
    req.usuario.sub,
    Number(req.params.asignacionId),
    { monto: Number(req.body.monto), motivo: req.body.motivo.trim() }
  );
  res.status(201).json({ success: true, data, message: 'Descuento registrado' });
}

async function responder(req, res) {
  const data = await DescuentosTurnoService.responder(
    req.usuario, Number(req.params.id), req.body.aceptar
  );
  res.json({ success: true, data, message: req.body.aceptar ? 'Descuento aceptado' : 'Descuento rechazado' });
}

async function eliminar(req, res) {
  await DescuentosTurnoService.eliminar(req.empresa_id, Number(req.params.id));
  res.json({ success: true, data: null, message: 'Descuento eliminado' });
}

module.exports = { listar, crear, responder, eliminar };
