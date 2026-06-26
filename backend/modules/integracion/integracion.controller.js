'use strict';

const ConfiguracionService = require('./services/configuracion.service');
const ConciliacionService  = require('./services/conciliacion.service');
const EntrantesService     = require('./services/entrantes.service');
const SalientesService     = require('./services/salientes.service');

async function recibirEventos(req, res) {
  const { event_id, tipo_evento, tenant_id, data } = req.body;
  const IntegracionModel = require('./integracion.model');
  const empresaId = await IntegracionModel.empresaIdPorTenantLogiq360(tenant_id);
  const resultado = await EntrantesService.recibirEvento({
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
  const data = await SalientesService.estado(req.empresa_id);
  res.json({ success: true, data, message: 'Estado de la integración' });
}

async function obtenerConfig(req, res) {
  const data = await ConfiguracionService.obtenerConfig(req.empresa_id);
  res.json({ success: true, data, message: 'Configuración de la integración' });
}

async function actualizarConfig(req, res) {
  const data = await ConfiguracionService.actualizarConfig(req.empresa_id, req.body);
  res.json({ success: true, data, message: 'Configuración actualizada' });
}

async function emparejar(req, res) {
  const data = await ConfiguracionService.emparejar(req.empresa_id, req.body.codigo);
  res.json({ success: true, data, message: 'Integración conectada con logiq360' });
}

async function publicEstado(req, res) {
  const { external_ref } = req.params;
  const data = await SalientesService.publicEstado(req.empresa_id, external_ref);
  res.json({ success: true, data });
}

async function publicEnSitio(req, res) {
  const { external_ref } = req.params;
  const data = await SalientesService.publicEnSitio(req.empresa_id, external_ref);
  res.json({ success: true, data });
}

async function conciliacion(req, res) {
  const data = await ConciliacionService.conciliacion(req.empresa_id);
  res.json({ success: true, data, message: 'Conciliación de personal' });
}

async function vincularEmpleado(req, res) {
  const { trabajador_id, empleado_id } = req.body;
  const data = await ConciliacionService.vincularEmpleado(req.empresa_id, trabajador_id, empleado_id);
  res.json({ success: true, data, message: 'Trabajador vinculado' });
}

async function publicTrabajadores(req, res) {
  const data = await SalientesService.publicTrabajadores(req.empresa_id);
  res.json({ success: true, data });
}

async function publicPing(req, res) {
  res.json({ ok: true, empresa_id: req.empresa_id });
}

module.exports = {
  recibirEventos, estado, obtenerConfig, actualizarConfig, emparejar,
  conciliacion, vincularEmpleado,
  publicEstado, publicEnSitio, publicTrabajadores, publicPing,
};
