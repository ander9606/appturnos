'use strict';

const crypto = require('crypto');
const IntegracionModel = require('../integracion.model');
const AppError = require('../../../utils/AppError');
const logger = require('../../../utils/logger');
const { hostExterno } = require('../../../utils/ssrfGuard');

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
      tiene_logiq360_api_key: Boolean(cfg.logiq360_api_key),
      configurado: true,
    };
  },

  /**
   * Actualiza la config; los campos no enviados conservan su valor.
   * logiq360_tenant_id/logiq360_base_url NUNCA se toman de `datos`: son
   * datos de sistema que solo emparejar() escribe, tomados de la respuesta
   * de logiq360 — si este PUT los aceptara del body, un admin_empresa
   * (confianza baja en un backend multi-tenant) podría apuntar el host al
   * que el worker de reconciliación le manda el api_key real por X-API-Key
   * (SSRF + robo de ese secreto).
   */
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
      logiq360_tenant_id: actual?.logiq360_tenant_id ?? null,
      logiq360_base_url: actual?.logiq360_base_url ?? null,
      logiq360_api_key: tomar('logiq360_api_key'),
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
    // El código lo pega el propio admin_empresa (confianza baja en un backend
    // multi-tenant) — sin este guard, `url` sería un SSRF: el backend haría
    // un POST autenticado a cualquier host que el atacante elija (mismo
    // criterio que logiq360_base_url, ver actualizarConfig arriba).
    if (!(await hostExterno(url))) {
      throw new AppError('Código de emparejamiento inválido', 400);
    }

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
      // b.incoming_secret es S_A (logiq360 firma sus webhooks salientes con esto) —
      // verificarFirmaLogiq360 lo necesita para validar la firma de cada webhook
      // entrante. appTurnosApiKey es un secreto DISTINTO: el que logiq360 debe
      // presentar como X-API-Key al consultar los endpoints pull de Zaturno: va
      // en logiq360_api_key, nunca en incoming_secret (bug histórico — mezclar
      // ambos aquí rompía la verificación de firma de todo webhook entrante).
      incoming_secret: b.incoming_secret,
      logiq360_tenant_id: b.tenant_id,
      logiq360_base_url: b.logiq360_base_url,
      logiq360_api_key: appTurnosApiKey,
    });

    // La gratuidad ya NO se otorga aquí de forma permanente: se deriva en vivo de
    // integracion_config.activo + api_key en cada request (ver IntegracionModel.estaConectado
    // y middleware/verificarSuscripcion.js). Guardar aquí un vigente_hasta=null fijo dejaría
    // a la empresa gratis para siempre aunque logiq360 la desconecte más tarde.

    // Conciliación automática por email: misma empresa, un tenant en cada app.
    // Best-effort — si logiq360 aún no tiene el personal sincronizado, se
    // completará al abrir la pantalla de Conciliación (self-heal).
    let autoVinculados = 0;
    try {
      const ConciliacionService = require('./conciliacion.service');
      ({ auto_vinculados: autoVinculados } = await ConciliacionService.autovincular(empresaId));
    } catch (err) {
      logger.error('[integracion] autovincular tras emparejar falló:', err.message);
    }

    return { conectado: true, logiq360_tenant_id: b.tenant_id, auto_vinculados: autoVinculados };
  },
};

module.exports = ConfiguracionService;
