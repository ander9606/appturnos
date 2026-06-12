'use strict';

const NotificacionesService = require('./notificaciones.service');

async function listar(req, res) {
  const page = Math.min(10000, Math.max(1, parseInt(req.query.page, 10) || 1));
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const soloNoLeidas = req.query.no_leidas === 'true' || req.query.no_leidas === '1';

  const { data, no_leidas, pagination } = await NotificacionesService.listar(
    req.empresa_id,
    req.usuario.sub,
    { soloNoLeidas, page, limit }
  );
  res.json({ success: true, data, no_leidas, pagination });
}

async function leer(req, res) {
  await NotificacionesService.marcarLeida(req.empresa_id, req.usuario.sub, Number(req.params.id));
  res.json({ success: true, data: null, message: 'Notificación marcada como leída' });
}

async function leerTodas(req, res) {
  const data = await NotificacionesService.marcarTodasLeidas(req.empresa_id, req.usuario.sub);
  res.json({ success: true, data, message: 'Notificaciones marcadas como leídas' });
}

module.exports = { listar, leer, leerTodas };
