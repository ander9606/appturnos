'use strict';

const { pool } = require('../../config/database');

/**
 * Acceso a datos de la integración con logiq360:
 * integracion_config, integration_events_in, integration_events_out.
 */
const IntegracionModel = {
  // ─── Configuración ──────────────────────────────────────────
  async obtenerConfig(empresaId) {
    const [filas] = await pool.query(
      'SELECT * FROM integracion_config WHERE empresa_id = ? LIMIT 1',
      [empresaId]
    );
    return filas[0] || null;
  },

  async guardarConfig(empresaId, d) {
    await pool.query(
      `INSERT INTO integracion_config
         (empresa_id, activo, webhook_url, webhook_secret, api_key, incoming_secret,
          logiq360_tenant_id, logiq360_base_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         activo = VALUES(activo),
         webhook_url = VALUES(webhook_url),
         webhook_secret = VALUES(webhook_secret),
         api_key = VALUES(api_key),
         incoming_secret = VALUES(incoming_secret),
         logiq360_tenant_id = VALUES(logiq360_tenant_id),
         logiq360_base_url = VALUES(logiq360_base_url)`,
      [
        empresaId,
        d.activo ? 1 : 0,
        d.webhook_url ?? null,
        d.webhook_secret ?? null,
        d.api_key ?? null,
        d.incoming_secret ?? null,
        d.logiq360_tenant_id ?? null,
        d.logiq360_base_url ?? null,
      ]
    );
  },

  /**
   * Resuelve el empresa_id de App Turnos a partir del tenant_id de logiq360.
   * No filtra por activo: el mapeo tenant↔empresa debe resolverse igual aunque
   * la integración esté pausada (p.ej. para recibir el evento integracion.activada
   * que la reactiva). Fallback retrocompatible: si nadie ha emparejado con ese
   * tenant, asume que empresa_id == tenant_id (comportamiento previo al pairing).
   */
  async empresaIdPorTenantLogiq360(tenantId) {
    const [filas] = await pool.query(
      'SELECT empresa_id FROM integracion_config WHERE logiq360_tenant_id = ? LIMIT 1',
      [tenantId]
    );
    return filas[0]?.empresa_id ?? tenantId;
  },

  /**
   * true si la empresa tiene la integración activa y api_key configurada.
   * Fuente única de verdad para "esta empresa usa Zaturno gratis vía logiq360" —
   * se evalúa en vivo en cada request (ver middleware/verificarSuscripcion.js),
   * nunca se cachea en empresas.plan/suscripcion_vigente_hasta.
   */
  async estaConectado(empresaId) {
    const [filas] = await pool.query(
      'SELECT activo, api_key FROM integracion_config WHERE empresa_id = ? LIMIT 1',
      [empresaId]
    );
    const fila = filas[0];
    return !!(fila && fila.activo === 1 && fila.api_key);
  },

  /**
   * Todas las integraciones ya emparejadas (con base_url y api_key), sin filtrar
   * por activo — la reconciliación periódica las necesita justo para detectar
   * cuándo ese campo quedó desincronizado. Ver services/reconciliacion.service.js.
   */
  async listarConfiguradas() {
    const [filas] = await pool.query(
      `SELECT empresa_id, activo, api_key, logiq360_base_url FROM integracion_config
       WHERE logiq360_base_url IS NOT NULL AND api_key IS NOT NULL`
    );
    return filas;
  },

  /** Activa/desactiva la integración (usado por los handlers de integracion.activada/desactivada). */
  async actualizarActivo(empresaId, activo) {
    await pool.query(
      'UPDATE integracion_config SET activo = ? WHERE empresa_id = ?',
      [activo ? 1 : 0, empresaId]
    );
  },

  // ─── Eventos entrantes ──────────────────────────────────────
  /** Inserta un evento entrante. Lanza ER_DUP_ENTRY si el event_id ya existe. */
  async registrarEntrante({ empresaId, eventId, tipoEvento, payload }) {
    const [res] = await pool.query(
      `INSERT INTO integration_events_in (empresa_id, event_id, tipo_evento, payload)
       VALUES (?, ?, ?, ?)`,
      [empresaId, eventId, tipoEvento, JSON.stringify(payload)]
    );
    return res.insertId;
  },

  async marcarEntranteProcesado(id) {
    await pool.query(
      "UPDATE integration_events_in SET estado = 'procesado', procesado_at = NOW() WHERE id = ?",
      [id]
    );
  },

  async marcarEntranteError(id, error) {
    await pool.query(
      "UPDATE integration_events_in SET estado = 'error', error_detalle = ? WHERE id = ?",
      [String(error).slice(0, 1000), id]
    );
  },

  // ─── Eventos salientes (cola) ───────────────────────────────
  async encolarSaliente({ empresaId, eventId, tipoEvento, payload }) {
    await pool.query(
      `INSERT INTO integration_events_out (empresa_id, event_id, tipo_evento, payload)
       VALUES (?, ?, ?, ?)`,
      [empresaId, eventId, tipoEvento, JSON.stringify(payload)]
    );
  },

  /** Eventos pendientes cuyo próximo intento ya venció, con la config del destino. */
  async listarPendientes(limite) {
    const [filas] = await pool.query(
      `SELECT e.id, e.empresa_id, e.event_id, e.tipo_evento, e.payload, e.intentos,
              c.webhook_url, c.webhook_secret, c.api_key
       FROM integration_events_out e
       JOIN integracion_config c ON c.empresa_id = e.empresa_id AND c.activo = 1
       WHERE e.estado = 'pendiente' AND e.proximo_intento <= NOW()
       ORDER BY e.proximo_intento
       LIMIT ?`,
      [limite]
    );
    return filas;
  },

  async marcarSalienteEnviado(id, intentos) {
    await pool.query(
      `UPDATE integration_events_out
       SET estado = 'enviado', enviado_at = NOW(), intentos = ?
       WHERE id = ?`,
      [intentos, id]
    );
  },

  async reprogramarSaliente(id, intentos, segundos, error) {
    await pool.query(
      `UPDATE integration_events_out
       SET intentos = ?, proximo_intento = DATE_ADD(NOW(), INTERVAL ? SECOND), ultimo_error = ?
       WHERE id = ?`,
      [intentos, segundos, String(error).slice(0, 1000), id]
    );
  },

  async marcarSalienteFallido(id, intentos, error) {
    await pool.query(
      `UPDATE integration_events_out
       SET estado = 'fallido', intentos = ?, ultimo_error = ?
       WHERE id = ?`,
      [intentos, String(error).slice(0, 1000), id]
    );
  },

  /** Resetea eventos fallidos a pendiente para que el worker los reintente. */
  async reintentarFallidos(empresaId) {
    const [res] = await pool.query(
      `UPDATE integration_events_out
       SET estado = 'pendiente', proximo_intento = NOW(), intentos = 0, ultimo_error = NULL
       WHERE empresa_id = ? AND estado = 'fallido'`,
      [empresaId]
    );
    return res.affectedRows;
  },

  /** Conteo de eventos por estado, para el endpoint de salud. */
  async estadisticas(empresaId) {
    const [salientes] = await pool.query(
      'SELECT estado, COUNT(*) AS total FROM integration_events_out WHERE empresa_id = ? GROUP BY estado',
      [empresaId]
    );
    const [entrantes] = await pool.query(
      'SELECT estado, COUNT(*) AS total FROM integration_events_in WHERE empresa_id = ? GROUP BY estado',
      [empresaId]
    );
    return { salientes, entrantes };
  },
};

module.exports = IntegracionModel;
