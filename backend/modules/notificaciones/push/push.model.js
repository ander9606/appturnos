'use strict';

const { pool } = require('../../../config/database');

/** Acceso a datos de suscripciones Web Push (tabla push_subscriptions). */
const PushModel = {
  /**
   * Registra una suscripción. Si el endpoint ya existe se actualiza
   * (mismo navegador re-suscribiéndose o rotación de claves).
   */
  async guardar({ empresaId, usuarioId, endpoint, p256dh, auth, userAgent }) {
    await pool.query(
      `INSERT INTO push_subscriptions
         (empresa_id, usuario_id, endpoint, p256dh, auth, user_agent)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         empresa_id = VALUES(empresa_id),
         usuario_id = VALUES(usuario_id),
         p256dh = VALUES(p256dh),
         auth = VALUES(auth),
         user_agent = VALUES(user_agent)`,
      [empresaId, usuarioId, endpoint, p256dh, auth, userAgent]
    );
  },

  async listarPorUsuario(usuarioId) {
    const [filas] = await pool.query(
      'SELECT id, usuario_id, endpoint, p256dh, auth FROM push_subscriptions WHERE usuario_id = ?',
      [usuarioId]
    );
    return filas;
  },

  async eliminarPorEndpoint(usuarioId, endpoint) {
    const [res] = await pool.query(
      'DELETE FROM push_subscriptions WHERE usuario_id = ? AND endpoint = ?',
      [usuarioId, endpoint]
    );
    return res.affectedRows;
  },

  // ── Expo Push Tokens ──────────────────────────────────────────────────────

  async guardarExpoToken(usuarioId, token) {
    await pool.query(
      `INSERT INTO expo_push_tokens (usuario_id, token) VALUES (?, ?)
       ON DUPLICATE KEY UPDATE usuario_id = VALUES(usuario_id)`,
      [usuarioId, token]
    );
  },

  async listarExpoTokensPorUsuario(usuarioId) {
    const [filas] = await pool.query(
      'SELECT token FROM expo_push_tokens WHERE usuario_id = ?',
      [usuarioId]
    );
    return filas.map((f) => f.token);
  },

  async eliminarExpoToken(usuarioId, token) {
    const [res] = await pool.query(
      'DELETE FROM expo_push_tokens WHERE usuario_id = ? AND token = ?',
      [usuarioId, token]
    );
    return res.affectedRows;
  },
};

module.exports = PushModel;
