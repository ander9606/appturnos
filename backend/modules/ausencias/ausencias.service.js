'use strict';

const AusenciasModel = require('./ausencias.model');
const TrabajadoresModel = require('../trabajadores/trabajadores.model');
const NotificacionesService = require('../notificaciones/notificaciones.service');
const AppError = require('../../utils/AppError');
const { ROLES } = require('../../config/constants');

const GESTORES = [ROLES.ADMIN_EMPRESA, ROLES.JEFE_TURNOS, ROLES.JEFE_NOMINA];

async function resolverTrabajador(empresaId, usuarioId) {
  const t = await TrabajadoresModel.obtenerPorUsuarioId(empresaId, usuarioId);
  if (!t) throw new AppError('Perfil de trabajador no encontrado', 404);
  return t;
}

const AusenciasService = {
  async listar(empresaId, usuario, { estado, page, limit }) {
    const offset = (page - 1) * limit;
    if (GESTORES.includes(usuario.rol)) {
      return AusenciasModel.listar(empresaId, { estado, limit, offset });
    }
    // trabajador: solo sus propias ausencias
    const t = await resolverTrabajador(empresaId, usuario.sub);
    return AusenciasModel.listarPorTrabajador(empresaId, t.id, { limit, offset });
  },

  async crear(empresaId, usuario, datos) {
    const t = await resolverTrabajador(empresaId, usuario.sub);
    if (datos.fecha_fin < datos.fecha_inicio) {
      throw new AppError('fecha_fin debe ser >= fecha_inicio', 400);
    }
    const id = await AusenciasModel.crear(empresaId, t.id, datos);

    // Notificar a gestores (best-effort)
    const [[gestores]] = await require('../../config/database').pool.query(
      `SELECT id FROM usuarios WHERE empresa_id = ? AND rol IN ('admin_empresa','jefe_turnos','jefe_nomina') AND activo = 1`,
      [empresaId]
    ).catch(() => [[[]]]); // eslint-disable-line no-unused-vars
    const gestoraIds = Array.isArray(gestores) ? gestores.map((g) => g.id) : [];
    if (gestoraIds.length) {
      await NotificacionesService.notificarVarios(gestoraIds, {
        empresaId,
        tipo: 'ausencia.nueva',
        titulo: 'Nueva solicitud de ausencia',
        mensaje: `${t.nombre} ${t.apellido} solicitó ${datos.tipo} del ${datos.fecha_inicio} al ${datos.fecha_fin}.`,
        data: { ausencia_id: id },
      });
    }

    return AusenciasModel.obtenerPorId(empresaId, id);
  },

  async actualizarEstado(empresaId, id, estado, aprobadoPor) {
    const ausencia = await AusenciasModel.obtenerPorId(empresaId, id);
    if (!ausencia) throw new AppError('Ausencia no encontrada', 404);
    if (ausencia.estado !== 'pendiente') {
      throw new AppError('Solo se puede actualizar una ausencia pendiente', 409);
    }
    const rows = await AusenciasModel.actualizarEstado(empresaId, id, estado, aprobadoPor);
    if (!rows) throw new AppError('No se pudo actualizar el estado', 500);

    // Notificar al trabajador
    const t = await TrabajadoresModel.obtenerPorId(empresaId, ausencia.trabajador_id).catch(() => null);
    if (t?.usuario_id) {
      await NotificacionesService.notificar({
        empresaId,
        usuarioId: t.usuario_id,
        tipo: 'ausencia.resuelta',
        titulo: estado === 'aprobada' ? 'Ausencia aprobada' : 'Ausencia rechazada',
        mensaje: `Tu solicitud de ${ausencia.tipo} fue ${estado}.`,
        data: { ausencia_id: id },
      });
    }

    return AusenciasModel.obtenerPorId(empresaId, id);
  },

  async contarPendientes(empresaId) {
    return AusenciasModel.contarPendientes(empresaId);
  },
};

module.exports = AusenciasService;