'use strict';

const IntegracionService = require('./integracion.service');

/**
 * POST /api/integracion/eventos — receptor de webhooks de logiq360.
 * La autenticación es la firma HMAC (middleware verificarFirmaLogiq360).
 */
async function recibirEventos(req, res) {
  const { event_id, tipo_evento, tenant_id, data } = req.body;
  // Resolver empresa_id real a partir del tenant_id de logiq360 (pairing).
  const IntegracionModel = require('./integracion.model');
  const empresaId = await IntegracionModel.empresaIdPorTenantLogiq360(tenant_id);
  const resultado = await IntegracionService.recibirEvento({
    empresaId,
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
 * POST /api/integracion/emparejar — conecta con logiq360 usando un código de un solo
 * uso generado allá. Persiste secretos y el mapeo tenant_id↔empresa_id sin exponer
 * ningún secreto al usuario.
 */
async function emparejar(req, res) {
  const baseUrl = process.env.PUBLIC_API_URL || `${req.protocol}://${req.get('host')}`;
  const data = await IntegracionService.emparejar(req.empresa_id, req.body.codigo, baseUrl);
  res.json({ success: true, data, message: 'Integración conectada con logiq360' });
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

/**
 * GET /api/integracion/conciliacion — trabajadores sin vincular + candidatos de
 * logiq360 + sugerencias de match por nombre.
 */
async function conciliacion(req, res) {
  const data = await IntegracionService.conciliacion(req.empresa_id);
  res.json({ success: true, data, message: 'Conciliación de personal' });
}

/** POST /api/integracion/conciliacion/vincular — vincula trabajador ↔ empleado logiq360. */
async function vincularEmpleado(req, res) {
  const { trabajador_id, empleado_id } = req.body;
  const data = await IntegracionService.vincularEmpleado(req.empresa_id, trabajador_id, empleado_id);
  res.json({ success: true, data, message: 'Trabajador vinculado' });
}

module.exports = {
  recibirEventos, estado, obtenerConfig, actualizarConfig, emparejar,
  conciliacion, vincularEmpleado,
  publicEstado, publicEnSitio,
};
