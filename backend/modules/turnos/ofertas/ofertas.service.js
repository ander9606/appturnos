'use strict';

const OfertasModel = require('./ofertas.model');
const AsignacionesModel = require('../asignaciones/asignaciones.model');
const TrabajadoresModel = require('../../trabajadores/trabajadores.model');
const TrabajadorEmpresaModel = require('../../trabajador-empresa/trabajador-empresa.model');
const NotificacionesService = require('../../notificaciones/notificaciones.service');
const AppError = require('../../../utils/AppError');
const { ROLES } = require('../../../config/constants');

/**
 * Resuelve el trabajador vinculado al usuario autenticado en una empresa concreta.
 * Para TRABAJADOR_TURNOS multi-empresa se debe pasar la empresaId de la oferta.
 */
async function resolverTrabajador(empresaId, usuarioId) {
  const trabajador = await TrabajadoresModel.obtenerPorUsuarioId(empresaId, usuarioId);
  if (!trabajador) {
    throw new AppError('Tu usuario no está vinculado a un trabajador activo en esta empresa', 403);
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
 * Solo aplica al path de empresa única (TRABAJADOR_TURNOS con un solo tenant).
 */
async function antiguedadMinima(empresaId, usuario) {
  if (usuario.rol !== ROLES.TRABAJADOR_TURNOS) return 0;
  const trabajador = await resolverTrabajador(empresaId, usuario.sub);
  return delayPorRanking(trabajador.ranking);
}

const OfertasService = {
  /**
   * Lista ofertas con paginación.
   * - Para TRABAJADOR_TURNOS: ruta multi-empresa — obtiene todas las empresas
   *   activas del trabajador y aplica delay de visibilidad POR empresa via JOIN.
   * - Para otros roles: ruta clásica de empresa única.
   *
   * `empresasActivas` es el array inyectado por `resolverEmpresasActivas`.
   */
  async listar(empresaId, usuario, { fecha, estado, disponibles, page, limit }, empresasActivas) {
    const offset = (page - 1) * limit;

    if (usuario.rol === ROLES.TRABAJADOR_TURNOS) {
      // Multi-empresa: el delay se aplica dentro del modelo via JOIN.
      const ids = empresasActivas && empresasActivas.length
        ? empresasActivas
        : await TrabajadorEmpresaModel.listarEmpresaIds(usuario.sub);

      const { data, total } = await OfertasModel.listarMultiEmpresa(usuario.sub, ids, {
        fecha,
        estado,
        disponibles,
        limit,
        offset,
      });
      return { data, pagination: { page, limit, total } };
    }

    // Ruta clásica: empresa única desde el JWT.
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

  /**
   * Detalle de la oferta junto con sus asignaciones.
   * Para TRABAJADOR_TURNOS: la empresa de la oferta debe estar en sus activas.
   */
  async obtener(empresaId, id, usuario, empresasActivas) {
    if (usuario.rol === ROLES.TRABAJADOR_TURNOS) {
      // Obtener la oferta directamente por id sin filtrar por empresa_id.
      // Luego validar que la empresa de la oferta es una de las activas del trabajador.
      const oferta = await OfertasModel.obtenerPorId(empresaId, id, 0);
      if (!oferta) throw new AppError('Oferta no encontrada', 404);

      const ids = empresasActivas && empresasActivas.length
        ? empresasActivas
        : await TrabajadorEmpresaModel.listarEmpresaIds(usuario.sub);

      if (!ids.includes(oferta.empresa_id)) {
        throw new AppError('Oferta no encontrada', 404);
      }
      // Validar delay de visibilidad para esta empresa.
      const trabajador = await TrabajadoresModel.obtenerPorUsuarioId(oferta.empresa_id, usuario.sub);
      const delay = delayPorRanking(trabajador?.ranking);
      const ofertaConDelay = await OfertasModel.obtenerPorId(oferta.empresa_id, id, delay);
      if (!ofertaConDelay) throw new AppError('Oferta aún no disponible para tu nivel de ranking', 403);

      const asignaciones = await AsignacionesModel.listarPorOferta(oferta.empresa_id, id);
      return { ...ofertaConDelay, asignaciones };
    }

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

  /**
   * Postula al trabajador autenticado a la oferta.
   * Para TRABAJADOR_TURNOS multi-empresa: la empresa de la oferta se resuelve
   * desde la oferta misma (el trabajador puede estar en varias empresas).
   */
  async aplicar(empresaId, ofertaId, usuarioId, empresasActivas) {
    // Resolver la empresa real de la oferta (para TRABAJADOR_TURNOS el
    // empresaId del JWT es null; lo sacamos de la oferta directamente).
    let empresaOfertaId = empresaId;

    if (!empresaId) {
      // Buscar la oferta sin filtro de empresa para obtener su empresa_id.
      const { pool } = require('../../../config/database');
      const [[ofertaBase]] = await pool.query(
        'SELECT empresa_id FROM ofertas_turno WHERE id = ? LIMIT 1',
        [ofertaId]
      );
      if (!ofertaBase) throw new AppError('Oferta no encontrada', 404);
      empresaOfertaId = ofertaBase.empresa_id;

      // Validar que la empresa de la oferta es una de las activas del trabajador.
      const ids = empresasActivas && empresasActivas.length
        ? empresasActivas
        : await TrabajadorEmpresaModel.listarEmpresaIds(usuarioId);
      if (!ids.includes(empresaOfertaId)) {
        throw new AppError('Oferta no encontrada', 404);
      }
    }

    // Se resuelve primero el trabajador para aplicar la visibilidad por ranking:
    // un trabajador no puede postularse a una oferta que aún no le es visible.
    const trabajador = await resolverTrabajador(empresaOfertaId, usuarioId);
    const oferta = await OfertasModel.obtenerPorId(
      empresaOfertaId,
      ofertaId,
      delayPorRanking(trabajador.ranking)
    );
    if (!oferta) throw new AppError('Oferta no encontrada o aún no disponible', 404);
    if (oferta.estado !== 'abierta' && oferta.estado !== 'publicada') {
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

    const id = await AsignacionesModel.crear(empresaOfertaId, ofertaId, trabajador.id);
    return AsignacionesModel.obtenerPorId(empresaOfertaId, id);
  },

  /** Retira la postulación del trabajador autenticado (solo si sigue pendiente). */
  async retirar(empresaId, ofertaId, usuarioId, empresasActivas) {
    // Resolver empresa de la oferta para multi-empresa.
    let empresaOfertaId = empresaId;
    if (!empresaId) {
      const { pool } = require('../../../config/database');
      const [[ofertaBase]] = await pool.query(
        'SELECT empresa_id FROM ofertas_turno WHERE id = ? LIMIT 1',
        [ofertaId]
      );
      if (!ofertaBase) throw new AppError('No estás postulado a esta oferta', 404);
      empresaOfertaId = ofertaBase.empresa_id;
    }

    const trabajador = await resolverTrabajador(empresaOfertaId, usuarioId);
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
    await AsignacionesModel.eliminar(empresaOfertaId, asignacion.id);
  },
};

module.exports = OfertasService;
