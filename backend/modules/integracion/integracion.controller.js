'use strict';

const IntegracionService = require('./integracion.service');

/**
 * POST /api/integracion/eventos — receptor de webhooks de logiq360.
 * La autenticación es la firma HMAC (middleware verificarFirmaLogiq360).
 */
async function recibirEventos(req, res) {
  const { event_id, tipo_evento, tenant_id, data } = req.body;
  const resultado = await IntegracionService.recibirEvento({
    empresaId: tenant_id,
    eventId: event_id,
    tipoEvento: tipo_evento,
    payload: { data },
  });
  res.json({
    success: true,
    data: resultado,
    message: resultado.duplicado ? 'Evento ya recibido' : 'Evento recibido',
  });
}

async function estado(req, res) {
  const data = await IntegracionService.estado(req.empresa_id);
  res.json({ success: true, data, message: 'Estado de la integración' });
}

async function obtenerConfig(req, res) {
  const data = await IntegracionService.obtenerConfig(req.empresa_id);
  res.json({ success: true, data, message: 'Configuración de la integración' });
}

async function actualizarConfig(req, res) {
  const data = await IntegracionService.actualizarConfig(req.empresa_id, req.body);
  res.json({ success: true, data, message: 'Configuración actualizada' });
}

/**
 * GET /api/integracion/public/estado/:external_ref
 * Permite que logiq360 consulte el estado de una oferta y sus contratos a partir
 * del external_ref que él mismo generó (ej: "logiq360:orden:47").
 * Auth: X-API-Key header que coincide con `incoming_secret` de integracion_config.
 */
async function publicEstado(req, res) {
  const { external_ref } = req.params;
  const data = await IntegracionService.publicEstado(req.empresa_id, external_ref);
  res.json({ success: true, data });
}

/**
 * GET /api/integracion/public/en-sitio/:external_ref
 * Retorna qué trabajadores están actualmente en campo (ingreso marcado, sin egreso)
 * para la oferta vinculada al external_ref dado.
 * Auth: X-API-Key header (mismo mecanismo que publicEstado).
 */
async function publicEnSitio(req, res) {
  const { external_ref } = req.params;
  const data = await IntegracionService.publicEnSitio(req.empresa_id, external_ref);
  res.json({ success: true, data });
}

module.exports = {
  recibirEventos, estado, obtenerConfig, actualizarConfig,
  publicEstado, publicEnSitio,
};
