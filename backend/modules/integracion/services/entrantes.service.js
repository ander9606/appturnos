'use strict';

const IntegracionModel = require('../integracion.model');
const entrantesHandlers = require('../entrantes.handlers');
const logger = require('../../../utils/logger');
const AppError = require('../../../utils/AppError');

// integracion.activada/desactivada anuncian el propio cambio de `activo` — deben
// aceptarse aunque la integración esté marcada inactiva, o nunca podría reactivarse.
const EVENTOS_SISTEMA = new Set(['integracion.activada', 'integracion.desactivada']);

const EntrantesService = {
  /**
   * Recibe un evento de logiq360: registra (deduplicando por event_id)
   * y procesa con el handler correspondiente.
   */
  async recibirEvento({ empresaId, eventId, tipoEvento, payload }) {
    const cfg = await IntegracionModel.obtenerConfig(empresaId);
    if (!cfg) {
      throw new AppError('Integración no configurada para este tenant', 403);
    }
    if (!cfg.activo && !EVENTOS_SISTEMA.has(tipoEvento)) {
      throw new AppError('Integración no activa para este tenant', 403);
    }

    let registroId;
    try {
      registroId = await IntegracionModel.registrarEntrante({ empresaId, eventId, tipoEvento, payload });
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') return { duplicado: true };
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
};

module.exports = EntrantesService;
