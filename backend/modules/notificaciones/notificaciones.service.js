'use strict';

const NotificacionesModel = require('./notificaciones.model');
const PushService = require('./push/push.service');
const AppError = require('../../utils/AppError');
const logger = require('../../utils/logger');

/**
 * Notificaciones in-app. Las funciones de emisión (`notificar`,
 * `notificarVarios`) son best-effort: registran el fallo pero nunca lanzan,
 * para no tumbar la operación de negocio que las dispara.
 */
const NotificacionesService = {
  async notificar({ empresaId, usuarioId, tipo, titulo, mensaje, data }) {
    if (!usuarioId) return; // destinatario sin cuenta de usuario: no hay a quién notificar
    try {
      await NotificacionesModel.crear({ empresaId, usuarioId, tipo, titulo, mensaje, data });
    } catch (err) {
      logger.error('[notificaciones] no se pudo crear la notificación:', err.message);
    }
    // Web Push (navegadores) — best-effort.
    await PushService.enviar(empresaId, usuarioId, { tipo, titulo, mensaje, data });
    // Expo Push (app móvil) — best-effort.
    await PushService.enviarExpo(usuarioId, { titulo, mensaje, data });
  },

  async notificarVarios(usuarioIds, base) {
    await Promise.all(
      (usuarioIds || []).map((usuarioId) =>
        NotificacionesService.notificar({ ...base, usuarioId })
      )
    );
  },

  async listar(empresaId, usuarioId, { soloNoLeidas, page, limit }) {
    const offset = (page - 1) * limit;
    const { data, total, no_leidas } = await NotificacionesModel.listar(empresaId, usuarioId, {
      soloNoLeidas,
      limit,
      offset,
    });
    return { data, no_leidas, pagination: { page, limit, total } };
  },

  async marcarLeida(empresaId, usuarioId, id) {
    const filas = await NotificacionesModel.marcarLeida(empresaId, usuarioId, id);
    if (filas === 0) {
      throw new AppError('Notificación no encontrada o ya estaba leída', 404);
    }
  },

  async marcarTodasLeidas(empresaId, usuarioId) {
    const marcadas = await NotificacionesModel.marcarTodasLeidas(empresaId, usuarioId);
    return { marcadas };
  },
};

module.exports = NotificacionesService;
