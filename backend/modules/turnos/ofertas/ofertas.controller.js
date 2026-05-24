'use strict';

const OfertasService = require('./ofertas.service');

async function listar(req, res) {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const disponibles = req.query.disponibles === 'true' || req.query.disponibles === '1';

  const { data, pagination } = await OfertasService.listar(
    req.empresa_id,
    req.usuario,
    { fecha: req.query.fecha || undefined, estado: req.query.estado || undefined, disponibles, page, limit },
    req.empresasActivas   // ← inyectado por resolverEmpresasActivas para TRABAJADOR_TURNOS
  );
  res.json({ success: true, data, pagination });
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

async function aplicar(req, res) {
  const data = await OfertasService.aplicar(
    req.empresa_id,
    Number(req.params.id),
    req.usuario.sub,
    req.empresasActivas
  );
  res.status(201).json({ success: true, data, message: 'Postulación registrada' });
}

async function retirar(req, res) {
  await OfertasService.retirar(
    req.empresa_id,
    Number(req.params.id),
    req.usuario.sub,
    req.empresasActivas
  );
  res.json({ success: true, data: null, message: 'Postulación retirada' });
}

module.exports = { listar, obtener, crear, actualizar, cancelar, aplicar, retirar };
