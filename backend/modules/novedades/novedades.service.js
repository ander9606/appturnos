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
    const asignacion = await _validarAcceso(empresaId, asignacionId, usuario);
    return NovedadesModel.getByAsignacion(asignacion.empresa_id, asignacionId);
  },

  async crear(empresaId, asignacionId, tipo, descripcion, horaEvento, fotoB64, usuario, latitud, longitud) {
    const asignacion = await _validarAcceso(empresaId, asignacionId, usuario);
    const empresaIdReal = asignacion.empresa_id;

    const novedad = await NovedadesModel.create(
      empresaIdReal, asignacionId, usuario.sub, tipo, descripcion, horaEvento, fotoB64, latitud, longitud
    );

    // Notificar a los demás participantes (best-effort).
    const todos = await NovedadesModel.getParticipantes(empresaIdReal, asignacionId);
    const otros = todos.filter((id) => id !== usuario.sub);
    const label = TIPOS_LABEL[tipo] ?? 'Novedad';
    await NotificacionesService.notificarVarios(otros, {
      empresaId: empresaIdReal,
      tipo: 'novedad_turno',
      titulo: label,
      mensaje: descripcion.length > 100 ? descripcion.slice(0, 97) + '…' : descripcion,
      data: { asignacion_id: asignacionId },
    });

    // Si el turno viene de logiq360 (external_ref), le avisamos del incidente
    // (best-effort — nunca debe romper el flujo de reportar la novedad, por
    // eso es una consulta aparte de la de _validarAcceso).
    try {
      const detalles = await AsignacionesModel.obtenerConDetalles(empresaIdReal, asignacionId);
      if (detalles?.oferta_external_ref) {
        await IntegracionService.emitir(empresaIdReal, 'novedad.reportada', {
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

/**
 * trabajador_turnos tiene empresa_id = null en el JWT (puede estar vinculado a
 * varias empresas) — obtenerPorId ya sabe omitir el filtro empresa_id en ese
 * caso; de ahí sacamos el empresa_id real de la fila para todo lo demás.
 */
async function _validarAcceso(empresaId, asignacionId, usuario) {
  const asignacion = await AsignacionesModel.obtenerPorId(empresaId, asignacionId);
  if (!asignacion) throw new AppError('Asignación no encontrada', 404);

  if (GESTORES.includes(usuario.rol)) return asignacion; // jefe/admin: acceso libre dentro de la empresa

  // Trabajador: solo si está asignado
  if (usuario.rol === ROLES.TRABAJADOR_TURNOS) {
    const { pool } = require('../../config/database');
    const [[row]] = await pool.query(
      'SELECT 1 FROM trabajadores WHERE id = ? AND usuario_id = ?',
      [asignacion.trabajador_id, usuario.sub]
    );
    if (!row) throw new AppError('No tienes acceso a este turno', 403);
    return asignacion;
  }

  throw new AppError('Sin permiso', 403);
}

module.exports = NovedadesService;
