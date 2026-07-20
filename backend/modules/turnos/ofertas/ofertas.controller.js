'use strict';

const OfertasService = require('./ofertas.service');
const AsignacionesService = require('../asignaciones/asignaciones.service');

async function listar(req, res) {
  const page = Math.min(10000, Math.max(1, parseInt(req.query.page, 10) || 1));
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const disponibles = req.query.disponibles === 'true' || req.query.disponibles === '1';

  const { data, pagination } = await OfertasService.listar(
    req.empresa_id,
    req.usuario,
    { fecha: req.query.fecha || undefined, estado: req.query.estado || undefined, disponibles, page, limit, paraQuien: req.query.para_quien || undefined },
    req.empresasActivas   // ← inyectado por resolverEmpresasActivas para TRABAJADOR_TURNOS
  );
  res.json({ success: true, data: { data, pagination } });
}

async function obtener(req, res) {
  const data = await OfertasService.obtener(
    req.empresa_id,
    Number(req.params.id),
    req.usuario,
    req.empresasActivas
  );
  res.json({ success: true, data, message: 'Detalle de la oferta' });
}

async function crear(req, res) {
  const data = await OfertasService.crear(req.empresa_id, req.body, req.usuario.sub);
  res.status(201).json({ success: true, data, message: 'Oferta creada' });
}

async function actualizar(req, res) {
  const data = await OfertasService.actualizar(req.empresa_id, Number(req.params.id), req.body);
  res.json({ success: true, data, message: 'Oferta actualizada' });
}

async function cancelar(req, res) {
  await OfertasService.cancelar(req.empresa_id, Number(req.params.id));
  res.json({ success: true, data: null, message: 'Oferta cancelada' });
}

async function eliminarDefinitivo(req, res) {
  await OfertasService.eliminarDefinitivo(req.empresa_id, Number(req.params.id));
  res.json({ success: true, data: null, message: 'Oferta eliminada' });
}

async function aplicar(req, res) {
  const data = await OfertasService.aplicar(
    req.empresa_id,
    Number(req.params.id),
    Number(req.body.puesto_id),
    req.usuario.sub,
    req.empresasActivas,
    req.usuario
  );
  res.status(201).json({ success: true, data, message: 'Postulación registrada' });
}

async function retirar(req, res) {
  await OfertasService.retirar(
    req.empresa_id,
    Number(req.params.id),
    Number(req.body.puesto_id),
    req.usuario.sub,
    req.empresasActivas
  );
  res.json({ success: true, data: null, message: 'Postulación retirada' });
}

async function asignar(req, res) {
  const data = await AsignacionesService.asignarDirecto(
    req.empresa_id,
    Number(req.params.id),
    req.body
  );
  res.status(201).json({ success: true, data, message: 'Trabajador asignado al turno' });
}

async function cerrar(req, res) {
  const excepciones = (req.body.excepciones || []).map(Number);
  const data = await AsignacionesService.cerrarMasivo(
    req.empresa_id,
    Number(req.params.id),
    excepciones
  );
  res.json({ success: true, data, message: `Jornada cerrada: ${data.cerradas} completado(s), ${data.noPresentados} no presentado(s)` });
}

async function duplicar(req, res) {
  const data = await OfertasService.duplicar(
    req.empresa_id,
    Number(req.params.id),
    req.body.fecha,
    req.usuario.sub
  );
  res.status(201).json({ success: true, data, message: 'Oferta duplicada' });
}

module.exports = { listar, obtener, crear, actualizar, cancelar, eliminarDefinitivo, aplicar, retirar, asignar, cerrar, duplicar };
