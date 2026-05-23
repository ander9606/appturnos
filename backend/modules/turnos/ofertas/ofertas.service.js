'use strict';

const OfertasModel = require('./ofertas.model');
const AsignacionesModel = require('../asignaciones/asignaciones.model');
const TrabajadoresModel = require('../../trabajadores/trabajadores.model');
const NotificacionesService = require('../../notificaciones/notificaciones.service');
const AppError = require('../../../utils/AppError');
const { ROLES } = require('../../../config/constants');

/** Resuelve el trabajador vinculado al usuario autenticado. */
async function resolverTrabajador(empresaId, usuarioId) {
  const trabajador = await TrabajadoresModel.obtenerPorUsuarioId(empresaId, usuarioId);
  if (!trabajador) {
    throw new AppError('Tu usuario no está vinculado a un trabajador activo', 403);
  }
  return trabajador;
}

/**
 * Visibilidad escalonada: minutos que el trabajador debe esperar antes de
 * ver una oferta nueva, según su ranking (0–5 estrellas). Los mejor
 * calificados ven al instante; los nuevos sin calificación esperan un poco.
 */
function delayPorRanking(ranking) {
  if (ranking == null) return 15; // trabajador nuevo, sin calificaciones
  const r = Number(ranking);
  if (r >= 4.5) return 0;
  if (r >= 3.5) return 15;
  if (r >= 2.5) return 30;
  return 60;
}

/**
 * Devuelve la antigüedad mínima (en minutos) que debe tener una oferta
 * para ser visible para este usuario. 0 para admin y jefe_turnos.
 */
async function antiguedadMinima(empresaId, usuario) {
  if (usuario.rol !== ROLES.TRABAJADOR_TURNOS) return 0;
  const trabajador = await resolverTrabajador(empresaId, usuario.sub);
  return delayPorRanking(trabajador.ranking);
}

const OfertasService = {
  async listar(empresaId, usuario, { fecha, estado, disponibles, page, limit }) {
    const offset = (page - 1) * limit;
    const antiguedadMinMin = await antiguedadMinima(empresaId, usuario);
    const { data, total } = await OfertasModel.listar(empresaId, {
      fecha,
      estado,
      disponibles,
      antiguedadMinMin,
      limit,
      offset,
    });
    return { data, pagination: { page, limit, total } };
  },

  /** Detalle de la oferta junto con sus asignaciones. */
  async obtener(empresaId, id, usuario) {
    const antiguedadMinMin = await antiguedadMinima(empresaId, usuario);
    const oferta = await OfertasModel.obtenerPorId(empresaId, id, antiguedadMinMin);
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

  /**
   * Cancela la oferta (idempotente si ya estaba cancelada), cancela sus
   * asignaciones vigentes y notifica a los trabajadores asignados.
   */
  async cancelar(empresaId, id) {
    const oferta = await OfertasModel.obtenerPorId(empresaId, id);
    if (!oferta) throw new AppError('Oferta no encontrada', 404);
    if (oferta.estado === 'cancelada') return;
    if (oferta.estado === 'completada') {
      throw new AppError('No se puede cancelar una oferta completada', 409);
    }

    // Se captura a quién notificar antes de cancelar las asignaciones.
    const destinatarios = await AsignacionesModel.listarUsuariosAsignados(empresaId, id);
    await OfertasModel.cancelar(empresaId, id);

    await NotificacionesService.notificarVarios(destinatarios, {
      empresaId,
      tipo: 'oferta.cancelada',
      titulo: 'Turno cancelado',
      mensaje: `El turno "${oferta.titulo}" del ${oferta.fecha} fue cancelado.`,
      data: { oferta_id: id },
    });
  },

  /** Postula al trabajador autenticado a la oferta. */
  async aplicar(empresaId, ofertaId, usuarioId) {
    // Se resuelve primero el trabajador para aplicar la visibilidad por ranking:
    // un trabajador no puede postularse a una oferta que aún no le es visible.
    const trabajador = await resolverTrabajador(empresaId, usuarioId);
    const oferta = await OfertasModel.obtenerPorId(
      empresaId,
      ofertaId,
      delayPorRanking(trabajador.ranking)
    );
    if (!oferta) throw new AppError('Oferta no encontrada o aún no disponible', 404);
    if (oferta.estado !== 'abierta') {
      throw new AppError('La oferta no está abierta a postulaciones', 409);
    }
    if (oferta.plazas_cubiertas >= oferta.plazas_disponibles) {
      throw new AppError('La oferta ya no tiene plazas disponibles', 409);
    }

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
