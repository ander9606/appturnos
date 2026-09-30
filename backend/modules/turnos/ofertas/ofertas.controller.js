'use strict';

const OfertasService = require('./ofertas.service');
const AsignacionesService = require('../asignaciones/asignaciones.service');

async function listar(req, res) {
  const page = Math.min(10000, Math.max(1, parseInt(req.query.page, 10) || 1));
  const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const disponibles = req.query.disponibles === 'true' || req.query.disponibles === '1';

  const { data, pagination } = await OfertasService.listar(
    req.empresa_id,
    req.usuario,
    {
      fecha: req.query.fecha || undefined,
      fechaDesde: req.query.fecha_desde || undefined,
      fechaHasta: req.query.fecha_hasta || undefined,
      estado: req.query.estado || undefined,
      disponibles, page, limit,
      paraQuien: req.query.para_quien || undefined,
    },
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

async function publicar(req, res) {
  const data = await OfertasService.publicar(req.empresa_id, Number(req.params.id));
  res.json({ success: true, data, message: 'Oferta publicada' });
}

async function completar(req, res) {
  const capearHoras = req.body?.capear_horas !== false;
  const data = await OfertasService.completar(req.empresa_id, Number(req.params.id), { capearHoras });
  const avisos = [];
  const f = data.forzados_al_completar;
  if (f > 0) {
    const horario = data.forzados_con_hora_actual ? 'con la hora actual' : 'con el horario estipulado del turno';
    avisos.push(`${f} trabajador${f > 1 ? 'es' : ''} que no había${f > 1 ? 'n' : ''} marcado salida se cerró${f > 1 ? 'aron' : ''} automáticamente ${horario}`);
  }
  const n = data.no_presentados_al_completar;
  if (n > 0) avisos.push(`${n} trabajador${n > 1 ? 'es' : ''} sin ingreso quedó${n > 1 ? 'aron' : ''} como no presentado${n > 1 ? 's' : ''}`);
  const d = data.auto_declinados_al_completar;
  if (d > 0) avisos.push(`${d} trabajador${d > 1 ? 'es' : ''} que nunca respondió${d > 1 ? 'n' : ''} al cambio de horario/lugar quedó${d > 1 ? 'aron' : ''} sin ese turno`);
  const extra = avisos.length > 0 ? ` (${avisos.join('; ')})` : '';
  res.json({ success: true, data, message: `Oferta marcada como completada${extra}` });
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
    req.usuario.sub,
    req.body.hora_inicio || null
  );
  res.status(201).json({ success: true, data, message: 'Oferta duplicada' });
}

module.exports = { listar, obtener, crear, actualizar, publicar, completar, cancelar, eliminarDefinitivo, aplicar, retirar, asignar, cerrar, duplicar };
