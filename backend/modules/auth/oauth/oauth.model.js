'use strict';

const { pool } = require('../../../config/database');

/**
 * Acceso a datos de vínculos OAuth (tabla usuarios_oauth).
 */
const OAuthModel = {
  /** Busca un vínculo por (provider, provider_user_id). */
  async buscarLinkPorProvider(provider, providerUserId) {
    const [filas] = await pool.query(
      `SELECT id, usuario_id, provider, provider_user_id, email, email_verified
       FROM usuarios_oauth
       WHERE provider = ? AND provider_user_id = ?
       LIMIT 1`,
      [provider, providerUserId]
    );
    return filas[0] || null;
  },

  /** Lista los providers vinculados a un usuario (para "Mi perfil"). */
  async listarPorUsuario(usuarioId) {
    const [filas] = await pool.query(
      `SELECT id, provider, email, email_verified, avatar_url, created_at, ultima_sesion
       FROM usuarios_oauth
       WHERE usuario_id = ?
       ORDER BY created_at`,
      [usuarioId]
    );
    return filas;
  },

  async crearLink({ usuarioId, provider, providerUserId, email, emailVerified, avatarUrl }) {
    const [res] = await pool.query(
      `INSERT INTO usuarios_oauth
         (usuario_id, provider, provider_user_id, email, email_verified, avatar_url)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        usuarioId,
        provider,
        providerUserId,
        email || null,
        emailVerified ? 1 : 0,
        avatarUrl || null,
      ]
    );
    return res.insertId;
  },

  async actualizarUltimaSesion(id) {
    await pool.query(
      'UPDATE usuarios_oauth SET ultima_sesion = NOW() WHERE id = ?',
      [id]
    );
  },

  /** Desvincular un proveedor de la cuenta (acción del usuario). */
  async eliminarLink(usuarioId, provider) {
    const [res] = await pool.query(
      'DELETE FROM usuarios_oauth WHERE usuario_id = ? AND provider = ?',
      [usuarioId, provider]
    );
    return res.affectedRows;
  },
};

module.exports = OAuthModel;
