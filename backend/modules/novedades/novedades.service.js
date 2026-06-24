'use strict';

const NovedadesModel = require('./novedades.model');
const AsignacionesModel = require('../turnos/asignaciones/asignaciones.model');
const NotificacionesService = require('../notificaciones/notificaciones.service');
const AppError = require('../../utils/AppError');
const { ROLES } = require('../../config/constants');

const GESTORES = [ROLES.ADMIN_EMPRESA, ROLES.JEFE_TURNOS];

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

  async crear(empresaId, asignacionId, tipo, descripcion, usuario) {
    await _validarAcceso(empresaId, asignacionId, usuario);

    const novedad = await NovedadesModel.create(
      empresaId, asignacionId, usuario.id, tipo, descripcion
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
