'use strict';

const ReportesService = require('./reportes.service');

// Rango por defecto cuando no se envían fechas (cubre cualquier dato real).
const RANGO_MIN = '1900-01-01';
const RANGO_MAX = '2999-12-31';

function rango(req) {
  return {
    desde: req.query.desde || RANGO_MIN,
    hasta: req.query.hasta || RANGO_MAX,
  };
}

async function asistencia(req, res) {
  const data = await ReportesService.asistencia(req.empresa_id, rango(req));
  res.json({ success: true, data, message: 'Reporte de asistencia' });
}

async function costos(req, res) {
  const data = await ReportesService.costos(req.empresa_id, rango(req));
  res.json({ success: true, data, message: 'Reporte de costos de mano de obra' });
}

async function trabajador(req, res) {
  const data = await ReportesService.historialTrabajador(
    req.empresa_id,
    Number(req.params.id),
    rango(req)
  );
  res.json({ success: true, data, message: 'Historial del trabajador' });
}

module.exports = { asistencia, costos, trabajador };
