'use strict';

const ReportesService = require('./reportes.service');
const { ROLES } = require('../../config/constants');

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

// Cuánto se le paga a cada persona lo ven quienes ya ven la liquidación: admin, jefe de nómina y nomina.
// El jefe de turnos no.
const verPagos = (req) => [ROLES.ADMIN_EMPRESA, ROLES.JEFE_NOMINA, ROLES.NOMINA].includes(req.usuario.rol);

async function costos(req, res) {
  const data = await ReportesService.costos(req.empresa_id, rango(req), { verPagos: verPagos(req) });
  res.json({ success: true, data, message: 'Reporte de costos de mano de obra' });
}

async function resumen(req, res) {
  const data = await ReportesService.resumen(req.empresa_id, rango(req), { verPagos: verPagos(req) });
  res.json({ success: true, data, message: 'Resumen del período' });
}

async function personas(req, res) {
  const data = await ReportesService.personas(req.empresa_id, rango(req), { verPagos: verPagos(req) });
  res.json({ success: true, data, message: 'Personas: horas y reparto de turnos' });
}

async function trabajador(req, res) {
  const data = await ReportesService.historialTrabajador(
    req.empresa_id,
    Number(req.params.id),
    rango(req),
    { verPagos: verPagos(req) }
  );
  res.json({ success: true, data, message: 'Historial del trabajador' });
}

module.exports = { asistencia, costos, resumen, personas, trabajador };
