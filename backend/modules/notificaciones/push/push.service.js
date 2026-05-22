'use strict';

const webpush = require('web-push');

const PushModel = require('./push.model');
const logger = require('../../../utils/logger');

/**
 * Entrega de notificaciones por Web Push.
 *
 * La configuración VAPID es opcional: si no hay claves, la entrega push
 * queda deshabilitada y `enviar` es un no-op, de modo que App Turnos sigue
 * funcionando con las notificaciones in-app únicamente.
 *
 * Generar las claves con:  npm run generar-vapid
 */

const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:soporte@app-turnos.com';

let pushHabilitado = false;
if (VAPID_PUBLIC && VAPID_PRIVATE) {
  try {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
    pushHabilitado = true;
  } catch (err) {
    logger.error('[push] claves VAPID inválidas, entrega push deshabilitada:', err.message);
  }
}
if (!pushHabilitado) {
  logger.warn('[push] VAPID no configurado; la entrega push está deshabilitada');
}

const PushService = {
  estaHabilitado() {
    return pushHabilitado;
  },

  clavePublica() {
    return pushHabilitado ? VAPID_PUBLIC : null;
  },

  async registrarSuscripcion(empresaId, usuarioId, { endpoint, keys, userAgent }) {
    await PushModel.guardar({
      empresaId,
      usuarioId,
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
      userAgent: userAgent || null,
    });
  },

  async eliminarSuscripcion(usuarioId, endpoint) {
    await PushModel.eliminarPorEndpoint(usuarioId, endpoint);
  },

  /**
   * Envía una notificación push a todas las suscripciones del usuario.
   * Best-effort: nunca lanza. Las suscripciones caducadas (404/410) se
   * eliminan automáticamente.
   */
  async enviar(empresaId, usuarioId, payload) {
    if (!pushHabilitado || !usuarioId) return;

    let suscripciones;
    try {
      suscripciones = await PushModel.listarPorUsuario(usuarioId);
    } catch (err) {
      logger.error('[push] no se pudieron leer las suscripciones:', err.message);
      return;
    }

    const cuerpo = JSON.stringify(payload);
    await Promise.all(
      suscripciones.map(async (sub) => {
        const suscripcion = {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        };
        try {
          await webpush.sendNotification(suscripcion, cuerpo);
        } catch (err) {
          if (err.statusCode === 404 || err.statusCode === 410) {
            // Suscripción caducada: se descarta.
            await PushModel.eliminarPorEndpoint(sub.usuario_id, sub.endpoint).catch(() => {});
          } else {
            logger.error('[push] fallo al enviar notificación:', err.message);
          }
        }
      })
    );
  },
};

module.exports = PushService;
