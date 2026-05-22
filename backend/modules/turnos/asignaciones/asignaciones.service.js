'use strict';

const AsignacionesModel = require('./asignaciones.model');
const TrabajadoresModel = require('../../trabajadores/trabajadores.model');
const AppError = require('../../../utils/AppError');

/** Resuelve el trabajador vinculado al usuario autenticado. */
async function resolverTrabajador(empresaId, usuarioId) {
  const trabajador = await TrabajadoresModel.obtenerPorUsuarioId(empresaId, usuarioId);
  if (!trabajador) {
    throw new AppError('Tu usuario no está vinculado a un trabajador activo', 403);
  }
  return trabajador;
}

const AsignacionesService = {
  async listar(empresaId, { fecha, oferta_id, trabajador_id, page, limit }) {
    const offset = (page - 1) * limit;
    const { data, total } = await AsignacionesModel.listar(empresaId, {
      fecha,
      ofertaId: oferta_id,
      trabajadorId: trabajador_id,
      limit,
      offset,
    });
    return { data, pagination: { page, limit, total } };
  },

  async confirmar(empresaId, id) {
    const res = await AsignacionesModel.confirmar(empresaId, id);
    if (!res.ok) {
      const errores = {
        no_existe: ['Asignación no encontrada', 404],
        estado: ['La asignación no está pendiente de confirmación', 409],
        oferta: ['La oferta asociada no está abierta', 409],
        lleno: ['La oferta ya no tiene plazas disponibles', 409],
      };
      const [mensaje, codigo] = errores[res.motivo];
      throw new AppError(mensaje, codigo);
    }
    return AsignacionesModel.obtenerPorId(empresaId, id);
  },

  async marcarIngreso(empresaId, id, usuarioId, { latitud, longitud }) {
    const asignacion = await AsignacionesModel.obtenerPorId(empresaId, id);
    if (!asignacion) throw new AppError('Asignación no encontrada', 404);

    const trabajador = await resolverTrabajador(empresaId, usuarioId);
    if (asignacion.trabajador_id !== trabajador.id) {
      throw new AppError('Esta asignación no te pertenece', 403);
    }
    if (asignacion.estado !== 'confirmado') {
      throw new AppError('Solo puedes marcar ingreso en un turno confirmado', 409);
    }

    await AsignacionesModel.registrarIngreso(empresaId, id, latitud, longitud);
    return AsignacionesModel.obtenerPorId(empresaId, id);
  },

  async marcarEgreso(empresaId, id, usuarioId, { firma_b64 }) {
    const asignacion = await AsignacionesModel.obtenerPorId(empresaId, id);
    if (!asignacion) throw new AppError('Asignación no encontrada', 404);

    const trabajador = await resolverTrabajador(empresaId, usuarioId);
    if (asignacion.trabajador_id !== trabajador.id) {
      throw new AppError('Esta asignación no te pertenece', 403);
    }
    if (asignacion.estado !== 'en_progreso') {
      throw new AppError('Debes marcar el ingreso antes de marcar la salida', 409);
    }

    await AsignacionesModel.registrarEgreso(empresaId, id, firma_b64);
    return AsignacionesModel.obtenerPorId(empresaId, id);
  },

  async misTurnos(empresaId, usuarioId) {
    const trabajador = await resolverTrabajador(empresaId, usuarioId);
    return AsignacionesModel.listarPorTrabajador(empresaId, trabajador.id);
  },
};

module.exports = AsignacionesService;
