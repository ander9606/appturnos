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
 * POST genérico a un endpoint de la API de Expo Push. Nunca lanza — devuelve
 * `json.data` o [] si falla, así el caller puede seguir en modo best-effort.
 */
function _postExpo(path, body) {
  const data = JSON.stringify(body);
  return new Promise((resolve) => {
    const options = {
      hostname: 'exp.host',
      path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
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
          logger.error(`[push] respuesta de Expo (${path}) no es JSON válido:`, raw.slice(0, 300));
          return resolve(undefined);
        }
        if (res.statusCode !== 200 || json?.errors) {
          logger.error(`[push] Expo API (${path}) respondió ${res.statusCode}:`, JSON.stringify(json?.errors ?? json));
        }
        resolve(json?.data);
      });
    });
    req.on('error', (err) => {
      logger.error(`[push] fallo de red al llamar a Expo (${path}):`, err.message);
      resolve(undefined);
    });
    req.write(data);
    req.end();
  });
}

const EXPO_LIMITE_LOTE = 100; // Expo rechaza requests con mas de 100 mensajes

/**
 * Envía mensajes a la API de Expo Push (best-effort, sin lanzar), en lotes
 * de EXPO_LIMITE_LOTE. Devuelve los "tickets" de respuesta (mismo orden e
 * indice que `messages`) — un lote fallido rellena con `undefined` en vez
 * de encoger el arreglo, para no desalinear el mapeo ticket→token del caller.
 */
async function _enviarExpoBatch(messages) {
  if (!messages.length) return [];
  const tickets = [];
  for (let i = 0; i < messages.length; i += EXPO_LIMITE_LOTE) {
    const lote = messages.slice(i, i + EXPO_LIMITE_LOTE);
    const resultado = await _postExpo('/--/api/v2/push/send', lote);
    if (Array.isArray(resultado) && resultado.length === lote.length) {
      tickets.push(...resultado);
    } else {
      tickets.push(...lote.map(() => undefined));
    }
  }
  return tickets;
}

/**
 * El ticket de /send solo confirma que Expo encoló el mensaje — errores del
 * lado de FCM/APNs (credenciales inválidas, token caduco, etc.) solo aparecen
 * acá, y solo unos segundos después de encolado. Ver: https://docs.expo.dev/push-notifications/sending-notifications/#push-receipts
 * A diferencia del error de ticket, este también borra el token caduco —
 * si no, queda fallando en silencio hasta que el usuario reabra la app.
 */
async function _revisarRecibos(usuarioId, entradas) {
  if (!entradas.length) return;
  const recibos = (await _postExpo('/--/api/v2/push/getReceipts', { ids: entradas.map((e) => e.id) })) ?? {};
  await Promise.all(
    entradas.map(({ id, token }) => {
      const recibo = recibos[id];
      if (recibo?.status !== 'error') return null;
      logger.error(`[push] recibo de error de Expo (usuario ${usuarioId}, ticket ${id}):`, recibo.message || recibo.details?.error);
      if (recibo.details?.error === 'DeviceNotRegistered') {
        return PushModel.eliminarExpoToken(usuarioId, token).catch((err) =>
          logger.error(`[push] no se pudo borrar token caduco (usuario ${usuarioId}):`, err.message)
        );
      }
      return null;
    })
  );
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
            await PushModel.eliminarPorEndpoint(sub.usuario_id, sub.endpoint).catch((delErr) =>
              logger.error(`[push] no se pudo borrar suscripción caducada (usuario ${sub.usuario_id}):`, delErr.message)
            );
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
      to:        token,
      sound:     'default',
      title:     payload.titulo,
      body:      payload.mensaje,
      // `tipo` viaja dentro de `data` (no hay campo aparte en la API de Expo) para
      // que el listener de push-tap en el cliente pueda decidir a dónde navegar.
      data:      { ...(payload.data || {}), tipo: payload.data?.tipo ?? payload.tipo },
      channelId: 'default', // debe existir en el cliente — ver setNotificationChannelAsync en pushNotifications.ts
    }));

    try {
      const tickets = await _enviarExpoBatch(messages);
      // Los tickets vienen en el mismo orden que `messages`/`tokens` — un token
      // con DeviceNotRegistered ya no existe en el dispositivo, se descarta.
      const entradasOk = [];
      await Promise.all(
        tickets.map((ticket, i) => {
          if (ticket?.status !== 'error') {
            if (ticket?.id) entradasOk.push({ id: ticket.id, token: tokens[i] });
            return null;
          }
          if (ticket?.details?.error === 'DeviceNotRegistered') {
            logger.info(`[push] token caduco (DeviceNotRegistered) descartado para usuario ${usuarioId}`);
            return PushModel.eliminarExpoToken(usuarioId, tokens[i]).catch((err) =>
              logger.error(`[push] no se pudo borrar token caduco (usuario ${usuarioId}):`, err.message)
            );
          }
          logger.error(`[push] ticket de error de Expo (usuario ${usuarioId}):`, ticket.message || ticket.details?.error);
          return null;
        })
      );
      // ponytail: setTimeout in-process para el chequeo de recibos, alcanza para
      // el volumen actual — upgrade a job programado si el envío crece mucho.
      if (entradasOk.length) {
        setTimeout(() => _revisarRecibos(usuarioId, entradasOk), 15000).unref();
      }
    } catch (err) {
      logger.error('[push] fallo en entrega Expo:', err.message);
    }
  },
};

module.exports = PushService;
