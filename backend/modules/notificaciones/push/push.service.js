'use strict';

const https = require('https');
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

/**
 * Envía mensajes a la API de Expo Push (best-effort, sin lanzar).
 * Devuelve los "tickets" de respuesta (mismo orden que `messages`), o []
 * si la petición falla — así el caller puede detectar tokens muertos.
 */
async function _enviarExpoBatch(messages) {
  if (!messages.length) return [];
  const body = JSON.stringify(messages);
  return new Promise((resolve) => {
    const options = {
      hostname: 'exp.host',
      path: '/--/api/v2/push/send',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip, deflate',
      },
    };
    const req = https.request(options, (res) => {
      let raw = '';
      res.on('data', (chunk) => { raw += chunk; });
      res.on('end', () => {
        let json;
        try {
          json = JSON.parse(raw);
        } catch {
          logger.error('[push] respuesta de Expo no es JSON válido:', raw.slice(0, 300));
          return resolve([]);
        }
        if (res.statusCode !== 200 || json?.errors) {
          logger.error(`[push] Expo API respondió ${res.statusCode}:`, JSON.stringify(json?.errors ?? json));
        }
        resolve(json?.data ?? []);
      });
    });
    req.on('error', (err) => {
      logger.error('[push] fallo de red al llamar a Expo:', err.message);
      resolve([]);
    });
    req.write(body);
    req.end();
  });
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
  // ── Expo Push ─────────────────────────────────────────────────────────────

  async registrarExpoToken(usuarioId, token) {
    await PushModel.guardarExpoToken(usuarioId, token);
    logger.info(`[push] Expo token registrado para usuario ${usuarioId}`);
  },

  async eliminarExpoToken(usuarioId, token) {
    await PushModel.eliminarExpoToken(usuarioId, token);
  },

  async enviarExpo(usuarioId, payload) {
    if (!usuarioId) {
      logger.warn(`[push] enviarExpo llamado sin usuarioId (tipo: ${payload?.tipo})`);
      return;
    }
    let tokens;
    try {
      tokens = await PushModel.listarExpoTokensPorUsuario(usuarioId);
    } catch (err) {
      logger.error('[push] no se pudieron leer los Expo tokens:', err.message);
      return;
    }
    if (!tokens.length) {
      logger.warn(`[push] usuario ${usuarioId} no tiene Expo push token registrado — no se envía`);
      return;
    }

    const messages = tokens.map((token) => ({
      to:    token,
      sound: 'default',
      title: payload.titulo,
      body:  payload.mensaje,
      data:  payload.data || {},
    }));

    try {
      const tickets = await _enviarExpoBatch(messages);
      // Los tickets vienen en el mismo orden que `messages`/`tokens` — un token
      // con DeviceNotRegistered ya no existe en el dispositivo, se descarta.
      await Promise.all(
        tickets.map((ticket, i) => {
          if (ticket?.status !== 'error') return null;
          if (ticket?.details?.error === 'DeviceNotRegistered') {
            return PushModel.eliminarExpoToken(usuarioId, tokens[i]).catch(() => {});
          }
          logger.error(`[push] ticket de error de Expo (usuario ${usuarioId}):`, ticket.message || ticket.details?.error);
          return null;
        })
      );
    } catch (err) {
      logger.error('[push] fallo en entrega Expo:', err.message);
    }
  },
};

module.exports = PushService;
