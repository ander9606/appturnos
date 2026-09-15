'use strict';

const AsignacionesModel = require('./asignaciones.model');
const TrabajadoresModel = require('../../trabajadores/trabajadores.model');
const { pool } = require('../../../config/database');
const NotificacionesService = require('../../notificaciones/notificaciones.service');
const IntegracionService = require('../../integracion/integracion.service');
const CoberturaService = require('../../integracion/cobertura.service');
const AppError = require('../../../utils/AppError');
const logger = require('../../../utils/logger');
const { fmtFechaCorta } = require('./asignaciones.helpers');

/** JOIN best-effort para la notificación — si falla, se loguea en vez de fallar en silencio. */
function obtenerDetallesParaNotificar(empresaId, id) {
  return AsignacionesModel.obtenerConDetalles(empresaId, id).catch((err) => {
    logger.error(`[asignaciones] obtenerConDetalles falló (id ${id}), no se notifica:`, err.message);
    return null;
  });
}

/**
 * Busca un turno confirmado/en curso que se solape en horario para el mismo USUARIO,
 * sin importar la empresa. `trabajador_id` es una fila por vínculo empresa-trabajador,
 * así que el traslape del modelo (dentro de una sola empresa) no alcanza a ver esto —
 * un trabajador_turnos suele trabajar para varias empresas a la vez.
 */
async function buscarSolapeOtraEmpresa(usuarioId, excluirAsignacionId, fecha, horaInicio, horaFinEstimada) {
  const horaFin = horaFinEstimada || '23:59:59';
  const [[fila]] = await pool.query(
    `SELECT a.id
     FROM asignaciones_turno a
     JOIN ofertas_turno o ON o.id = a.oferta_id
     JOIN trabajadores t2 ON t2.id = a.trabajador_id
     WHERE t2.usuario_id = ?
       AND a.id != ?
       AND a.estado IN ('confirmado', 'en_progreso')
       AND o.fecha = ?
       AND o.hora_inicio < ?
       AND COALESCE(o.hora_fin_estimada, '23:59:59') > ?
     LIMIT 1`,
    [usuarioId, excluirAsignacionId ?? 0, fecha, horaFin, horaInicio]
  );
  return Boolean(fila);
}

/**
 * Máquina de estados de la postulación/asignación: confirmar, cancelar,
 * rechazar, asignación directa, no-presentado y calificación. Ver
 * asignaciones.service.js para el resto de AsignacionesService.
 */
module.exports = {
  async confirmar(empresaId, id) {
    const asig = await AsignacionesModel.obtenerPorId(empresaId, id);
    if (asig) {
      const trabajador = await TrabajadoresModel.obtenerUsuarioIdYRol(asig.trabajador_id);
      const rolTrabajador = trabajador?.rol;

      // Ambos chequeos necesitan fecha/hora de la oferta — se piden una sola vez.
      const necesitaChequeo = rolTrabajador === 'trabajador_nomina' || rolTrabajador === 'trabajador_turnos';
      const ofertaRow = necesitaChequeo
        ? (await pool.query(
            `SELECT o.fecha, o.hora_inicio, o.hora_fin_estimada
             FROM asignaciones_turno a
             JOIN ofertas_turno o ON o.id = a.oferta_id
             WHERE a.id = ? AND a.empresa_id = ?`,
            [id, empresaId]
          ))[0][0]
        : null;

      if (ofertaRow && rolTrabajador === 'trabajador_nomina') {
        // La misma empresa no puede tenerlo en jornada de nómina y en turno a la vez.
        const horaFin = ofertaRow.hora_fin_estimada || '23:59:00';
        const [[solapado]] = await pool.query(
          `SELECT id FROM registros_diarios
           WHERE empresa_id = ? AND trabajador_id = ? AND fecha = ?
             AND hora_entrada IS NOT NULL
             AND hora_entrada < ? AND COALESCE(hora_salida,'23:59:00') > ?
           LIMIT 1`,
          [empresaId, asig.trabajador_id, ofertaRow.fecha, horaFin, ofertaRow.hora_inicio]
        );
        if (solapado) {
          throw new AppError('Conflicto con jornada laboral registrada para ese día y horario', 409);
        }
      }

      if (ofertaRow && rolTrabajador === 'trabajador_turnos' && trabajador.usuario_id) {
        const solapado = await buscarSolapeOtraEmpresa(
          trabajador.usuario_id, id, ofertaRow.fecha, ofertaRow.hora_inicio, ofertaRow.hora_fin_estimada
        );
        if (solapado) {
          throw new AppError('Este trabajador ya tiene un turno confirmado en otra empresa en ese horario', 409);
        }
      }
    }

    const res = await AsignacionesModel.confirmar(empresaId, id);
    if (!res.ok) {
      const errores = {
        no_existe: ['Asignación no encontrada', 404],
        estado:    ['La asignación no está pendiente de confirmación', 409],
        oferta:    ['La oferta ya no está disponible para confirmar', 409],
        vencida:   ['No se puede confirmar un turno cuya fecha ya pasó', 409],
        lleno:     ['La oferta ya no tiene plazas disponibles', 409],
        traslape:  ['El trabajador ya tiene un turno confirmado en ese horario', 409],
      };
      const [mensaje, codigo] = errores[res.motivo];
      throw new AppError(mensaje, codigo);
    }

    // Retorno simple — siempre funciona
    const asignacion = await AsignacionesModel.obtenerPorId(empresaId, id);

    // Detalles para la notificación (JOINs opcionales — best-effort)
    const detalles  = await obtenerDetallesParaNotificar(empresaId, id);
    const trabajadorUsuarioId = await TrabajadoresModel.obtenerUsuarioId(asignacion.trabajador_id);

    if (detalles) {
      const fecha = fmtFechaCorta(detalles.oferta_fecha);
      const hora  = detalles.hora_inicio?.slice(0, 5) ?? '';
      const lugar = detalles.lugar ? ` · ${detalles.lugar}` : '';
      const cargo = detalles.cargo_nombre ? ` como ${detalles.cargo_nombre}` : '';
      await NotificacionesService.notificar({
        empresaId,
        usuarioId: trabajadorUsuarioId,
        tipo: 'postulacion.confirmada',
        titulo: 'Turno confirmado',
        mensaje: `Quedaste confirmado${cargo} en "${detalles.oferta_titulo}" el ${fecha} a las ${hora}${lugar}. ¡Recuerda llegar a tiempo!`,
        data: { asignacion_id: id, oferta_id: asignacion.oferta_id },
      });

      // Notifica a logiq360 que este trabajador confirmó participación en la orden.
      if (detalles.oferta_external_ref) {
        await IntegracionService.emitir(empresaId, 'asignacion.confirmada', {
          external_ref:  detalles.oferta_external_ref,
          empleado_ref:  detalles.trabajador_external_ref || null,
          nombre:        detalles.trabajador_nombre,
          apellido:      detalles.trabajador_apellido,
          rol:           detalles.cargo_codigo || 'operario',
        });
      }
    }

    // Si esta confirmación completó todas las plazas de la oferta, avisa a
    // logiq360 (best-effort, idempotente — ver CoberturaService).
    await CoberturaService.verificarYEmitir(empresaId, asignacion.oferta_id);

    return asignacion;
  },

  async cancelar(empresaId, id, gestorId) {
    const res = await AsignacionesModel.cancelar(empresaId, id, gestorId);
    if (!res.ok) {
      const errores = {
        no_existe: ['Asignación no encontrada', 404],
        estado: ['Solo se pueden cancelar asignaciones confirmadas', 409],
      };
      const [mensaje, codigo] = errores[res.motivo];
      throw new AppError(mensaje, codigo);
    }

    const asignacion = await AsignacionesModel.obtenerPorId(empresaId, id);
    const detalles   = await obtenerDetallesParaNotificar(empresaId, id);
    const trabajadorUsuarioId = await TrabajadoresModel.obtenerUsuarioId(asignacion.trabajador_id);

    if (detalles) {
      const fecha = fmtFechaCorta(detalles.oferta_fecha);
      await NotificacionesService.notificar({
        empresaId,
        usuarioId: trabajadorUsuarioId,
        tipo: 'asignacion.cancelada',
        titulo: 'Turno cancelado',
        mensaje: `Tu turno "${detalles.oferta_titulo}" el ${fecha} fue cancelado por la empresa. Revisa otras ofertas disponibles.`,
        data: { asignacion_id: id, oferta_id: asignacion.oferta_id },
      });

      if (detalles.oferta_external_ref) {
        await IntegracionService.emitir(empresaId, 'asignacion.cancelada', {
          external_ref: detalles.oferta_external_ref,
          empleado_ref: detalles.trabajador_external_ref || null,
        });
      }
    }

    return asignacion;
  },

  async rechazar(empresaId, id, gestorId) {
    const res = await AsignacionesModel.rechazar(empresaId, id, gestorId);
    if (!res.ok) {
      const errores = {
        no_existe: ['Asignación no encontrada', 404],
        estado: ['Solo se pueden rechazar postulaciones pendientes', 409],
      };
      const [mensaje, codigo] = errores[res.motivo];
      throw new AppError(mensaje, codigo);
    }

    const asignacion = await AsignacionesModel.obtenerPorId(empresaId, id);
    const detalles   = await obtenerDetallesParaNotificar(empresaId, id);
    const trabajadorUsuarioId = await TrabajadoresModel.obtenerUsuarioId(asignacion.trabajador_id);

    if (detalles) {
      const fecha = fmtFechaCorta(detalles.oferta_fecha);
      await NotificacionesService.notificar({
        empresaId,
        usuarioId: trabajadorUsuarioId,
        tipo: 'postulacion.rechazada',
        titulo: 'Postulación no aceptada',
        mensaje: `Tu postulación para "${detalles.oferta_titulo}" el ${fecha} no fue aceptada. Revisa otras ofertas disponibles.`,
        data: { asignacion_id: id, oferta_id: asignacion.oferta_id },
      });
    }

    return asignacion;
  },

  /**
   * Asignación directa por gestor/admin: crea la asignación confirmada sin que el
   * trabajador tenga que postularse primero. Útil para cuadrar equipos rápido.
   */
  async asignarDirecto(empresaId, ofertaId, { puesto_id, trabajador_id }) {
    const trabajadorPrevio = await TrabajadoresModel.obtenerPorId(empresaId, trabajador_id);
    // obtenerPorId ya filtra por empresa_id — si vuelve null, el trabajador_id
    // recibido no pertenece a esta empresa (de otra empresa vinculada al mismo
    // usuario, o inexistente). Sin este chequeo, el modelo lo insertaría igual
    // sin validar la pertenencia — el mismo bug que corrompió data histórica
    // en la resolución de postulaciones (commit 563a743).
    if (!trabajadorPrevio) {
      throw new AppError('El trabajador no pertenece a esta empresa', 404);
    }
    const rolPrevio = trabajadorPrevio?.rol || trabajadorPrevio?.usuario_rol;
    if (rolPrevio === 'trabajador_turnos' && trabajadorPrevio.usuario_id) {
      const [[ofertaRow]] = await pool.query(
        `SELECT fecha, hora_inicio, hora_fin_estimada FROM ofertas_turno WHERE id = ? AND empresa_id = ?`,
        [ofertaId, empresaId]
      );
      if (ofertaRow) {
        const solapado = await buscarSolapeOtraEmpresa(
          trabajadorPrevio.usuario_id, null, ofertaRow.fecha, ofertaRow.hora_inicio, ofertaRow.hora_fin_estimada
        );
        if (solapado) {
          throw new AppError('Este trabajador ya tiene un turno confirmado en otra empresa en ese horario', 409);
        }
      }
    }

    const res = await AsignacionesModel.asignarDirecto(empresaId, ofertaId, puesto_id, trabajador_id);
    if (!res.ok) {
      const errores = {
        oferta:    ['La oferta no está disponible para asignaciones', 409],
        puesto:    ['El puesto no pertenece a esta oferta', 400],
        lleno:     ['El puesto ya no tiene plazas disponibles', 409],
        traslape:  ['El trabajador ya tiene un turno confirmado en ese horario', 409],
        duplicado: ['El trabajador ya está asignado a este puesto', 409],
      };
      const [mensaje, codigo] = errores[res.motivo];
      throw new AppError(mensaje, codigo);
    }

    const asignacion = await AsignacionesModel.obtenerPorId(empresaId, res.asignacionId);
    const detalles   = await obtenerDetallesParaNotificar(empresaId, res.asignacionId);
    const trabajadorUsuarioId = await TrabajadoresModel.obtenerUsuarioId(trabajador_id);

    if (detalles) {
      const fecha = fmtFechaCorta(detalles.oferta_fecha);
      const hora  = detalles.hora_inicio?.slice(0, 5) ?? '';
      const lugar = detalles.lugar ? ` · ${detalles.lugar}` : '';
      const cargo = detalles.cargo_nombre ? ` como ${detalles.cargo_nombre}` : '';
      await NotificacionesService.notificar({
        empresaId,
        usuarioId: trabajadorUsuarioId,
        tipo: 'postulacion.confirmada',
        titulo: 'Turno asignado',
        mensaje: `Fuiste asignado${cargo} en "${detalles.oferta_titulo}" el ${fecha} a las ${hora}${lugar}. ¡Recuerda llegar a tiempo!`,
        data: { asignacion_id: res.asignacionId, oferta_id: ofertaId },
      });

      if (detalles.oferta_external_ref) {
        await IntegracionService.emitir(empresaId, 'asignacion.confirmada', {
          external_ref:  detalles.oferta_external_ref,
          empleado_ref:  detalles.trabajador_external_ref || null,
          nombre:        detalles.trabajador_nombre,
          apellido:      detalles.trabajador_apellido,
          rol:           detalles.cargo_codigo || 'operario',
        });
      }
    }

    await CoberturaService.verificarYEmitir(empresaId, ofertaId);

    return asignacion;
  },

  async marcarNoPresentado(empresaId, id) {
    const res = await AsignacionesModel.marcarNoPresentado(empresaId, id);
    if (!res.ok) {
      const errores = {
        no_existe: ['Asignación no encontrada', 404],
        estado:    ['Solo se puede marcar como no presentado una asignación confirmada o en progreso', 409],
      };
      const [mensaje, codigo] = errores[res.motivo];
      throw new AppError(mensaje, codigo);
    }

    const asignacion = await AsignacionesModel.obtenerConDetalles(empresaId, id);
    const trabajadorUsuarioId = await TrabajadoresModel.obtenerUsuarioId(res.trabajador_id);

    if (trabajadorUsuarioId) {
      await NotificacionesService.notificar({
        empresaId,
        usuarioId: trabajadorUsuarioId,
        tipo: 'asignacion.no_presentado',
        titulo: 'Turno marcado como no presentado',
        mensaje: 'Fuiste marcado como no presentado en un turno. Esto impacta tu calificación y la visibilidad de futuras ofertas.',
        data: { asignacion_id: id, oferta_id: res.oferta_id },
      });
    }

    await IntegracionService.emitir(empresaId, 'trabajador.no_presentado', {
      external_ref: asignacion?.oferta_external_ref || null,
      empleado_ref: asignacion?.trabajador_external_ref || null,
      asignacion_id: id,
    });

    return asignacion;
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

    const trabajadorUsuarioId = await TrabajadoresModel.obtenerUsuarioId(asignacion.trabajador_id);
    await NotificacionesService.notificar({
      empresaId,
      usuarioId: trabajadorUsuarioId,
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
