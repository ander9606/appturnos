'use strict';

const IntegracionModel = require('../integracion.model');
const entrantesHandlers = require('../entrantes.handlers');
const logger = require('../../../utils/logger');

// 401/402 de logiq360 confirman que la api_key ya no autentica (activo=0 o
// plan sin la feature) — cualquier otro código (5xx, etc.) es un error
// transitorio y no debe hacernos tocar el estado local.
const CODIGOS_DESCONECTADO = new Set([401, 402]);

const ReconciliacionService = {
  /**
   * Consulta a logiq360 si la api_key de esta empresa sigue autenticando.
   * true = conectada, false = desconectada, null = no se pudo determinar
   * (red caída o error transitorio — no tocar el estado local en ese caso).
   */
  async _estadoReal(cfg) {
    if (!cfg?.logiq360_base_url || !cfg?.api_key) return null;
    const base = String(cfg.logiq360_base_url).replace(/\/$/, '');
    try {
      const resp = await fetch(`${base}/api/integracion/public/ping`, {
        headers: { 'X-API-Key': cfg.api_key },
        signal: AbortSignal.timeout(10_000),
      });
      if (resp.ok) return true;
      if (CODIGOS_DESCONECTADO.has(resp.status)) return false;
      return null;
    } catch {
      return null;
    }
  },

  /**
   * Corrige el drift entre integracion_config.activo y el estado real en
   * logiq360 — red de seguridad para cuando el webhook integracion.activada/
   * desactivada se pierde tras agotar sus reintentos (ver
   * docs/INTEGRACION-LOGIQ360-APP-TURNOS.md v1.2). Reutiliza los mismos
   * handlers que procesan esos eventos reales para no duplicar la lógica de
   * actualizar + notificar a los admin_empresa.
   */
  async reconciliarTodas() {
    const integraciones = await IntegracionModel.listarConfiguradas();
    let corregidas = 0;
    for (const cfg of integraciones) {
      try {
        const real = await ReconciliacionService._estadoReal(cfg);
        if (real === null || Boolean(cfg.activo) === real) continue;
        await entrantesHandlers.procesar(
          real ? 'integracion.activada' : 'integracion.desactivada',
          cfg.empresa_id,
          {}
        );
        corregidas++;
      } catch (err) {
        logger.error(`[reconciliacion] empresa ${cfg.empresa_id}:`, err.message);
      }
    }
    if (corregidas > 0) logger.info(`[reconciliacion] ${corregidas} integracion(es) corregida(s)`);
    return corregidas;
  },
};

module.exports = ReconciliacionService;
