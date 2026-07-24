'use strict';

const NovedadesModel = require('./novedades.model');
const AsignacionesModel = require('../turnos/asignaciones/asignaciones.model');
const NotificacionesService = require('../notificaciones/notificaciones.service');
const IntegracionService = require('../integracion/integracion.service');
const AppError = require('../../utils/AppError');
const logger = require('../../utils/logger');
const { ROLES } = require('../../config/constants');

const GESTORES = [ROLES.ADMIN_EMPRESA, ROLES.JEFE_TURNOS, ROLES.JEFE_NOMINA];

const TIPOS_LABEL = {
  retraso:   'Retraso',
  ausencia:  'Ausencia',
  incidente: 'Incidente',
  otro:      'Novedad',
};

const NovedadesService = {
  async listar(empresaId, asignacionId, usuario) {
    await _validarAcceso(empresaId, asignacionId, usuario);
    return NovedadesModel.getByAsignacion(empresaId, asignacionId);
  },

  async crear(empresaId, asignacionId, tipo, descripcion, horaEvento, fotoB64, usuario, latitud, longitud) {
    await _validarAcceso(empresaId, asignacionId, usuario);

    const novedad = await NovedadesModel.create(
      empresaId, asignacionId, usuario.id, tipo, descripcion, horaEvento, fotoB64, latitud, longitud
    );

    // Notificar a los demás participantes (best-effort).
    const todos = await NovedadesModel.getParticipantes(empresaId, asignacionId);
    const otros = todos.filter((id) => id !== usuario.id);
    const label = TIPOS_LABEL[tipo] ?? 'Novedad';
    await NotificacionesService.notificarVarios(otros, {
      empresaId,
      tipo: 'novedad_turno',
      titulo: label,
      mensaje: descripcion.length > 100 ? descripcion.slice(0, 97) + '…' : descripcion,
      data: { asignacion_id: asignacionId },
    });

    // Si el turno viene de logiq360 (external_ref), le avisamos del incidente
    // (best-effort — nunca debe romper el flujo de reportar la novedad).
    try {
      const detalles = await AsignacionesModel.obtenerConDetalles(empresaId, asignacionId);
      if (detalles?.oferta_external_ref) {
        await IntegracionService.emitir(detalles.empresa_id, 'novedad.reportada', {
          external_ref: detalles.oferta_external_ref,
          trabajador_nombre: `${detalles.trabajador_nombre} ${detalles.trabajador_apellido || ''}`.trim(),
          tipo_novedad: tipo,
          descripcion,
          hora_evento: horaEvento || null,
          latitud: latitud ?? null,
          longitud: longitud ?? null,
          tiene_foto: Boolean(fotoB64),
        });
      }
    } catch (err) {
      logger.error('[novedades] no se pudo emitir novedad.reportada:', err.message);
    }

    return novedad;
  },
};

async function _validarAcceso(empresaId, asignacionId, usuario) {
  const asignacion = await AsignacionesModel.obtenerPorId(empresaId, asignacionId);
  if (!asignacion) throw new AppError('Asignación no encontrada', 404);

  if (GESTORES.includes(usuario.rol)) return; // jefe/admin: acceso libre dentro de la empresa

  // Trabajador: solo si está asignado
  if (usuario.rol === ROLES.TRABAJADOR_TURNOS) {
    // asignacion.trabajador_id es el id de la tabla trabajadores, no de usuarios.
    // Necesitamos validar por usuario_id. La verificación más simple es que
    // la asignación pertenezca a la empresa y el autor sea quien llama.
    // El modelo getParticipantes ya lo resuelve; aquí hacemos una consulta directa.
    const { pool } = require('../../config/database');
    const [[row]] = await pool.query(
      `SELECT 1 FROM asignaciones_turno a
       JOIN trabajadores t ON t.id = a.trabajador_id
       WHERE a.id = ? AND a.empresa_id = ? AND t.usuario_id = ?`,
      [asignacionId, empresaId, usuario.id]
    );
    if (!row) throw new AppError('No tienes acceso a este turno', 403);
    return;
  }

  throw new AppError('Sin permiso', 403);
}

module.exports = NovedadesService;
