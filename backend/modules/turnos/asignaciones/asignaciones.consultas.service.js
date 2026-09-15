'use strict';

const AsignacionesModel = require('./asignaciones.model');
const TrabajadoresModel = require('../../trabajadores/trabajadores.model');
const AppError = require('../../../utils/AppError');
const { calcularHoras } = require('../../../utils/laboralUtils');
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
 * Lecturas y listados de asignaciones (sin mutar estado ni pago). Ver
 * asignaciones.service.js para el resto de AsignacionesService.
 */
module.exports = {
  async obtener(empresaId, id, usuario) {
    const asignacion = await AsignacionesModel.obtenerConDetalles(empresaId, id);
    if (!asignacion) throw new AppError('Asignación no encontrada', 404);
    // Workers can only view their own asignaciones. Valida usando usuario_id
    // directamente de la asignación (ya trae usuario_id del trabajador vinculado).
    if ([ROLES.TRABAJADOR_TURNOS, ROLES.TRABAJADOR_NOMINA].includes(usuario?.rol)) {
      if (asignacion.usuario_id !== usuario.sub) {
        throw new AppError('Asignación no encontrada', 404);
      }
    }
    return asignacion;
  },

  async listar(empresaId, { fecha, oferta_id, trabajador_id, estado, sospechoso, page, limit }) {
    const offset = (page - 1) * limit;
    const { data, total } = await AsignacionesModel.listar(empresaId, {
      fecha,
      ofertaId: oferta_id,
      trabajadorId: trabajador_id,
      estado,
      sospechoso,
      limit,
      offset,
    });
    return { data, pagination: { page, limit, total } };
  },

  async misTurnos(empresaId, usuarioId) {
    // trabajador_turnos tiene empresa_id = null en el JWT (multi-empresa).
    // Se localiza por usuario_id a través de trabajador_empresa.
    let asignaciones;
    if (!empresaId) {
      asignaciones = await AsignacionesModel.listarPorUsuario(usuarioId);
    } else {
      const trabajador = await resolverTrabajador(empresaId, usuarioId);
      asignaciones = await AsignacionesModel.listarPorTrabajador(empresaId, trabajador.id);
    }

    // Enrich completado shifts with Colombian labor-law hour breakdown.
    // mysql2 may return DATETIME as a Date object or a string; extractTime handles both.
    const extractTime = (dt) => {
      const s = dt instanceof Date ? dt.toISOString() : String(dt);
      return s.slice(11, 19); // 'HH:MM:SS'
    };

    return asignaciones.map((a) => {
      if (a.estado !== 'completado' || !a.hora_ingreso_real || !a.hora_egreso_real) {
        return a;
      }
      const desglose = calcularHoras({
        horaEntrada: extractTime(a.hora_ingreso_real),
        horaSalida:  extractTime(a.hora_egreso_real),
        fecha:       a.oferta_fecha,
      });
      return { ...a, ...desglose };
    });
  },
};
