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

module.exports = { recibirEventos, estado, obtenerConfig, actualizarConfig };
