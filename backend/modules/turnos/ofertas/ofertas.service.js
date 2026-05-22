'use strict';

const OfertasModel = require('./ofertas.model');
const AsignacionesModel = require('../asignaciones/asignaciones.model');
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

const OfertasService = {
  async listar(empresaId, { fecha, estado, disponibles, page, limit }) {
    const offset = (page - 1) * limit;
    const { data, total } = await OfertasModel.listar(empresaId, {
      fecha,
      estado,
      disponibles,
      limit,
      offset,
    });
    return { data, pagination: { page, limit, total } };
  },

  /** Detalle de la oferta junto con sus asignaciones. */
  async obtener(empresaId, id) {
    const oferta = await OfertasModel.obtenerPorId(empresaId, id);
    if (!oferta) throw new AppError('Oferta no encontrada', 404);
    const asignaciones = await AsignacionesModel.listarPorOferta(empresaId, id);
    return { ...oferta, asignaciones };
  },

  async crear(empresaId, datos, creadoPor) {
    const id = await OfertasModel.crear(empresaId, datos, creadoPor);
    return OfertasModel.obtenerPorId(empresaId, id);
  },

  async actualizar(empresaId, id, datos) {
    const oferta = await OfertasModel.obtenerPorId(empresaId, id);
    if (!oferta) throw new AppError('Oferta no encontrada', 404);
    if (oferta.estado !== 'abierta') {
      throw new AppError('Solo se puede editar una oferta mientras está abierta', 409);
    }
    await OfertasModel.actualizar(empresaId, id, datos);
    return OfertasModel.obtenerPorId(empresaId, id);
  },

  /** Cancela la oferta (idempotente si ya estaba cancelada). */
  async cancelar(empresaId, id) {
    const oferta = await OfertasModel.obtenerPorId(empresaId, id);
    if (!oferta) throw new AppError('Oferta no encontrada', 404);
    if (oferta.estado === 'cancelada') return;
    if (oferta.estado === 'completada') {
      throw new AppError('No se puede cancelar una oferta completada', 409);
    }
    await OfertasModel.cambiarEstado(empresaId, id, 'cancelada');
    // Nota: la notificación a los trabajadores asignados queda pendiente
    // del módulo de notificaciones.
  },

  /** Postula al trabajador autenticado a la oferta. */
  async aplicar(empresaId, ofertaId, usuarioId) {
    const oferta = await OfertasModel.obtenerPorId(empresaId, ofertaId);
    if (!oferta) throw new AppError('Oferta no encontrada', 404);
    if (oferta.estado !== 'abierta') {
      throw new AppError('La oferta no está abierta a postulaciones', 409);
    }
    if (oferta.plazas_cubiertas >= oferta.plazas_disponibles) {
      throw new AppError('La oferta ya no tiene plazas disponibles', 409);
    }

    const trabajador = await resolverTrabajador(empresaId, usuarioId);
    const existente = await AsignacionesModel.obtenerPorOfertaYTrabajador(
      ofertaId,
      trabajador.id
    );
    if (existente) throw new AppError('Ya estás postulado a esta oferta', 409);

    const id = await AsignacionesModel.crear(empresaId, ofertaId, trabajador.id);
    return AsignacionesModel.obtenerPorId(empresaId, id);
  },

  /** Retira la postulación del trabajador autenticado (solo si sigue pendiente). */
  async retirar(empresaId, ofertaId, usuarioId) {
    const trabajador = await resolverTrabajador(empresaId, usuarioId);
    const asignacion = await AsignacionesModel.obtenerPorOfertaYTrabajador(
      ofertaId,
      trabajador.id
    );
    if (!asignacion) throw new AppError('No estás postulado a esta oferta', 404);
    if (asignacion.estado !== 'pendiente') {
      throw new AppError(
        'No puedes retirar una postulación ya confirmada o en curso',
        409
      );
    }
    await AsignacionesModel.eliminar(empresaId, asignacion.id);
  },
};

module.exports = OfertasService;
