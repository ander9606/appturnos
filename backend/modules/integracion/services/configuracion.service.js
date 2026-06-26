'use strict';

const crypto = require('crypto');
const IntegracionModel = require('../integracion.model');
const AppError = require('../../../utils/AppError');

const ConfiguracionService = {
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
      logiq360_tenant_id: tomar('logiq360_tenant_id'),
      logiq360_base_url: tomar('logiq360_base_url'),
    });
    return ConfiguracionService.obtenerConfig(empresaId);
  },

  /**
   * Empareja con logiq360 a partir de un código generado allá.
   * Decodifica { url, nonce, webhook_url }, confirma contra logiq360 y
   * persiste el bundle de secretos + el mapeo tenant_id↔empresa_id.
   */
  async emparejar(empresaId, codigo) {
    let url, nonce, webhookUrl;
    try {
      ({ url, nonce, webhook_url: webhookUrl } = JSON.parse(Buffer.from(codigo, 'base64url').toString('utf8')));
    } catch {
      throw new AppError('Código de emparejamiento inválido', 400);
    }
    if (!url || !nonce) throw new AppError('Código de emparejamiento inválido', 400);

    const base = (process.env.PUBLIC_API_URL || '').replace(/\/$/, '');
    if (!base) throw new AppError('PUBLIC_API_URL no está configurada en el servidor. Agrega la URL pública de Zaturno en el .env antes de emparejar.', 500);
    const appTurnosApiKey = 'at_' + crypto.randomBytes(32).toString('hex');

    const resp = await fetch(`${url.replace(/\/$/, '')}/api/integracion/emparejar/confirmar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nonce,
        app_turnos_webhook_url: `${base}/api/integracion/eventos`,
        app_turnos_base_url: base || undefined,
        app_turnos_api_key: appTurnosApiKey,
      }),
    });
    const json = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      throw new AppError(json.message || `logiq360 rechazó el emparejamiento (HTTP ${resp.status})`, 400);
    }

    const b = json.data || {};
    await IntegracionModel.guardarConfig(empresaId, {
      activo: 1,
      webhook_url: webhookUrl || b.webhook_url,
      webhook_secret: b.webhook_secret,
      api_key: b.api_key,
      incoming_secret: appTurnosApiKey,
      logiq360_tenant_id: b.tenant_id,
      logiq360_base_url: b.logiq360_base_url,
    });

    // logiq360 cubre la suscripcion: plan empresarial indefinido
    const AdminModel = require('../../admin/admin.model');
    await AdminModel.actualizarSuscripcion(empresaId, {
      plan: 'empresarial',
      vigente_hasta: null,
      origen: 'logiq360',
    });

    return { conectado: true, logiq360_tenant_id: b.tenant_id };
  },
};

module.exports = ConfiguracionService;
