'use strict';

const AsignacionesModel = require('./asignaciones.model');
const TrabajadoresModel = require('../../trabajadores/trabajadores.model');
const PuntosMarcajeModel = require('../../puntos-marcaje/puntos-marcaje.model');
const NotificacionesService = require('../../notificaciones/notificaciones.service');
const IntegracionService = require('../../integracion/integracion.service');
const CostoLaborService = require('../../integracion/costo-labor.service');
const AppError = require('../../../utils/AppError');
const { estaEnAlgunPunto } = require('../../../utils/geoUtils');

/** Resuelve el trabajador vinculado al usuario autenticado. */
async function resolverTrabajador(empresaId, usuarioId) {
  const trabajador = await TrabajadoresModel.obtenerPorUsuarioId(empresaId, usuarioId);
  if (!trabajador) {
    throw new AppError('Tu usuario no está vinculado a un trabajador activo', 403);
  }
  return trabajador;
}

const AsignacionesService = {
  async obtener(empresaId, id) {
    const asignacion = await AsignacionesModel.obtenerConDetalles(empresaId, id);
    if (!asignacion) throw new AppError('Asignación no encontrada', 404);
    return asignacion;
  },

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

    const asignacion = await AsignacionesModel.obtenerPorId(empresaId, id);

    // Notifica al trabajador que su postulación fue confirmada (best-effort).
    const trabajador = await TrabajadoresModel.obtenerPorId(empresaId, asignacion.trabajador_id);
    await NotificacionesService.notificar({
      empresaId,
      usuarioId: trabajador?.usuario_id,
      tipo: 'postulacion.confirmada',
      titulo: 'Postulación confirmada',
      mensaje: 'Tu postulación a un turno fue confirmada. Revisa los detalles en la app.',
      data: { asignacion_id: id, oferta_id: asignacion.oferta_id },
    });

    return asignacion;
  },

  async marcarIngreso(empresaId, id, usuarioId, { latitud, longitud }) {
    const asignacion = await AsignacionesModel.obtenerConDetalles(empresaId, id);
    if (!asignacion) throw new AppError('Asignación no encontrada', 404);

    const trabajador = await resolverTrabajador(empresaId, usuarioId);
    if (asignacion.trabajador_id !== trabajador.id) {
      throw new AppError('Esta asignación no te pertenece', 403);
    }
    if (asignacion.estado !== 'confirmado') {
      throw new AppError('Solo puedes marcar ingreso en un turno confirmado', 409);
    }

    // Validación de geofence según tipo_geofence del cargo
    const gf = asignacion.geofence_info;
    if (gf.tipo === 'fijo' && gf.latitud != null) {
      const { ok } = estaEnAlgunPunto(latitud, longitud, [{
        latitud: gf.latitud, longitud: gf.longitud, radio_metros: gf.radio_metros,
      }]);
      if (!ok) {
        throw new AppError(
          `Debes estar en "${gf.nombre}" para registrar el ingreso`,
          422
        );
      }
    } else if (gf.tipo === 'zonal') {
      const puntos = await PuntosMarcajeModel.listarZonales(empresaId);
      if (puntos.length > 0) {
        const { ok } = estaEnAlgunPunto(latitud, longitud, puntos);
        if (!ok) {
          throw new AppError(
            'Debes estar en uno de los puntos zonales autorizados para registrar el ingreso',
            422
          );
        }
      }
    } else if (gf.tipo === 'oferta' && gf.latitud != null) {
      const { ok } = estaEnAlgunPunto(latitud, longitud, [{
        latitud: gf.latitud, longitud: gf.longitud, radio_metros: gf.radio_metros,
      }]);
      if (!ok) {
        throw new AppError(
          'Estás fuera del área de trabajo del turno',
          422
        );
      }
    }
    // tipo 'libre' → sin validación

    await AsignacionesModel.registrarIngreso(empresaId, id, latitud, longitud);
    await IntegracionService.emitir(empresaId, 'trabajador.ingreso', {
      asignacion_id: id,
      oferta_id: asignacion.oferta_id,
      trabajador_id: asignacion.trabajador_id,
      latitud,
      longitud,
    });
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
    await IntegracionService.emitir(empresaId, 'trabajador.egreso', {
      asignacion_id: id,
      oferta_id: asignacion.oferta_id,
      trabajador_id: asignacion.trabajador_id,
    });
    // Si este egreso completó la oferta entera, emite costo_labor.calculado
    // a logiq360 y marca la oferta como completada (best-effort).
    await CostoLaborService.verificarYEmitir(empresaId, asignacion.oferta_id);
    return AsignacionesModel.obtenerPorId(empresaId, id);
  },

  async misTurnos(empresaId, usuarioId) {
    const trabajador = await resolverTrabajador(empresaId, usuarioId);
    return AsignacionesModel.listarPorTrabajador(empresaId, trabajador.id);
  },

  /**
   * Califica una asignación completada (1–5 estrellas). Actualiza el
   * ranking del trabajador y notifica al trabajador (best-effort).
   * Una asignación solo puede calificarse una vez.
   */
  async calificar(empresaId, id, usuario, { calificacion, comentario }) {
    const asignacion = await AsignacionesModel.obtenerPorId(empresaId, id);
    if (!asignacion) throw new AppError('Asignación no encontrada', 404);
    if (asignacion.estado !== 'completado') {
      throw new AppError('Solo se puede calificar una asignación completada', 409);
    }

    let resultado;
    try {
      resultado = await AsignacionesModel.calificar(empresaId, id, {
        trabajadorId: asignacion.trabajador_id,
        calificacion,
        comentario: comentario || null,
        calificadoPor: usuario.sub,
      });
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        throw new AppError('Esta asignación ya fue calificada', 409);
      }
      throw err;
    }

    const trabajador = await TrabajadoresModel.obtenerPorId(empresaId, asignacion.trabajador_id);
    await NotificacionesService.notificar({
      empresaId,
      usuarioId: trabajador?.usuario_id,
      tipo: 'calificacion.recibida',
      titulo: 'Recibiste una calificación',
      mensaje: `Tu turno fue calificado con ${calificacion}/5 estrellas.`,
      data: { asignacion_id: id, calificacion },
    });

    return {
      asignacion_id: id,
      trabajador_id: asignacion.trabajador_id,
      ranking: resultado.ranking,
      total_calificaciones: resultado.total,
    };
  },
};

module.exports = AsignacionesService;
