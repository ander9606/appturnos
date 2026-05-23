'use strict';

const PushService = require('./push.service');

async function clavePublica(_req, res) {
  res.json({
    success: true,
    data: { clave_publica: PushService.clavePublica(), habilitado: PushService.estaHabilitado() },
    message: 'Clave pública VAPID',
  });
}

async function suscribir(req, res) {
  const { endpoint, keys } = req.body;
  await PushService.registrarSuscripcion(req.empresa_id, req.usuario.sub, {
    endpoint,
    keys,
    userAgent: req.headers['user-agent'],
  });
  res.status(201).json({ success: true, data: null, message: 'Suscripción push registrada' });
}

async function desuscribir(req, res) {
  await PushService.eliminarSuscripcion(req.usuario.sub, req.body.endpoint);
  res.json({ success: true, data: null, message: 'Suscripción push eliminada' });
}

module.exports = { clavePublica, suscribir, desuscribir };
