'use strict';

const crypto = require('crypto');

const IntegracionModel = require('./integracion.model');
const entrantesHandlers = require('./entrantes.handlers');
const { firmar } = require('../../utils/hmac');
const logger = require('../../utils/logger');

/**
 * Servicio de integración con logiq360.
 * Cubre: configuración, recepción de eventos entrantes (con deduplicación)
 * y cola de eventos salientes con reintentos exponenciales.
 */

// Backoff entre reintentos, en segundos (05-INTEGRACION.md): 0 → 30s → 2m → 10m → 1h
const INTERVALOS = [0, 30, 120, 600, 3600];
const MAX_INTENTOS = INTERVALOS.length;

const IntegracionService = {
  // ─── Configuración ──────────────────────────────────────────
  /** Config sin exponer los secretos en claro. */
  async obtenerConfig(empresaId) {
    const cfg = await IntegracionModel.obtenerConfig(empresaId);
    if (!cfg) {
      return { empresa_id: empresaId, activo: 0, webhook_url: null, configurado: false };
    }
    return {
      empresa_id: cfg.empresa_id,
      activo: cfg.activo,
      webhook_url: cfg.webhook_url,
      tiene_webhook_secret: Boolean(cfg.webhook_secret),
      tiene_api_key: Boolean(cfg.api_key),
      tiene_incoming_secret: Boolean(cfg.incoming_secret),
      configurado: true,
    };
  },

  /** Actualiza la config; los campos no enviados conservan su valor. */
  async actualizarConfig(empresaId, datos) {
    const actual = await IntegracionModel.obtenerConfig(empresaId);
    const tomar = (campo) =>
      datos[campo] !== undefined ? datos[campo] : actual ? actual[campo] : null;

    await IntegracionModel.guardarConfig(empresaId, {
      activo: datos.activo !== undefined ? datos.activo : actual?.activo ?? 0,
      webhook_url: tomar('webhook_url'),
      webhook_secret: tomar('webhook_secret'),
      api_key: tomar('api_key'),
      incoming_secret: tomar('incoming_secret'),
    });
    return IntegracionService.obtenerConfig(empresaId);
  },

  async estado(empresaId) {
    const cfg = await IntegracionModel.obtenerConfig(empresaId);
    const eventos = await IntegracionModel.estadisticas(empresaId);
    return {
      activo: Boolean(cfg?.activo),
      webhook_configurado: Boolean(cfg?.webhook_url),
      eventos,
    };
  },

  // ─── Eventos entrantes ──────────────────────────────────────
  /**
   * Recibe un evento de logiq360: lo registra (deduplicando por event_id)
   * y lo procesa con el handler correspondiente.
   */
  async recibirEvento({ empresaId, eventId, tipoEvento, payload }) {
    let registroId;
    try {
      registroId = await IntegracionModel.registrarEntrante({
        empresaId,
        eventId,
        tipoEvento,
        payload,
      });
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        return { duplicado: true }; // ya recibido: idempotente
      }
      throw err;
    }

    try {
      await entrantesHandlers.procesar(tipoEvento, empresaId, payload?.data);
      await IntegracionModel.marcarEntranteProcesado(registroId);
      return { duplicado: false, procesado: true };
    } catch (err) {
      await IntegracionModel.marcarEntranteError(registroId, err.message);
      logger.error(`[integracion] error procesando ${tipoEvento}:`, err.message);
      return { duplicado: false, procesado: false };
    }
  },

  // ─── Eventos salientes ──────────────────────────────────────
  /** Encola un evento hacia logiq360. Best-effort: nunca lanza. */
  async emitir(empresaId, tipoEvento, payload) {
    try {
      const cfg = await IntegracionModel.obtenerConfig(empresaId);
      if (!cfg || !cfg.activo) return; // integración inactiva
      await IntegracionModel.encolarSaliente({
        empresaId,
        eventId: crypto.randomUUID(),
        tipoEvento,
        payload,
      });
    } catch (err) {
      logger.error('[integracion] no se pudo encolar el evento:', err.message);
    }
  },

  /** Procesa la cola de eventos salientes pendientes. */
  async procesarCola() {
    const eventos = await IntegracionModel.listarPendientes(50);
    for (const evento of eventos) {
      await IntegracionService._enviar(evento);
    }
    return eventos.length;
  },

  async _enviar(evento) {
    const intentos = evento.intentos + 1;

    if (!evento.webhook_url) {
      await IntegracionModel.marcarSalienteFallido(evento.id, intentos, 'webhook_url no configurado');
      return;
    }

    const cuerpo = JSON.stringify({
      event_id: evento.event_id,
      tipo_evento: evento.tipo_evento,
      timestamp: new Date().toISOString(),
      data: evento.payload,
    });

    try {
      const headers = { 'Content-Type': 'application/json' };
      if (evento.webhook_secret) {
        headers['X-Turnos-Signature'] = firmar(cuerpo, evento.webhook_secret);
      }
      const resp = await fetch(evento.webhook_url, { method: 'POST', headers, body: cuerpo });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      await IntegracionModel.marcarSalienteEnviado(evento.id, intentos);
    } catch (err) {
      if (intentos >= MAX_INTENTOS) {
        await IntegracionModel.marcarSalienteFallido(evento.id, intentos, err.message);
        logger.error(
          `[integracion] evento ${evento.event_id} descartado tras ${intentos} intentos`
        );
      } else {
        await IntegracionModel.reprogramarSaliente(
          evento.id,
          intentos,
          INTERVALOS[intentos],
          err.message
        );
      }
    }
  },
};

module.exports = IntegracionService;
