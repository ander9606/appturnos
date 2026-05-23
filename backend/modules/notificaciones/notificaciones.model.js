'use strict';

const { pool } = require('../../config/database');

/** Acceso a datos de notificaciones (tabla notificaciones). */
const NotificacionesModel = {
  async crear({ empresaId, usuarioId, tipo, titulo, mensaje, data }) {
    const [res] = await pool.query(
      `INSERT INTO notificaciones (empresa_id, usuario_id, tipo, titulo, mensaje, data)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [empresaId, usuarioId, tipo, titulo, mensaje, data ? JSON.stringify(data) : null]
    );
    return res.insertId;
  },

  /** Listado del usuario + total y conteo de no leídas. */
  async listar(empresaId, usuarioId, { soloNoLeidas, limit, offset }) {
    const where = ['empresa_id = ?', 'usuario_id = ?'];
    const params = [empresaId, usuarioId];
    if (soloNoLeidas) where.push('leida = 0');
    const whereSql = where.join(' AND ');

    const [filas] = await pool.query(
      `SELECT id, tipo, titulo, mensaje, data, leida, leida_at, created_at
       FROM notificaciones WHERE ${whereSql}
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );
    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM notificaciones WHERE ${whereSql}`,
      params
    );
    const [[{ no_leidas }]] = await pool.query(
      `SELECT COUNT(*) AS no_leidas FROM notificaciones
       WHERE empresa_id = ? AND usuario_id = ? AND leida = 0`,
      [empresaId, usuarioId]
    );
    return { data: filas, total, no_leidas };
  },

  async marcarLeida(empresaId, usuarioId, id) {
    const [res] = await pool.query(
      `UPDATE notificaciones SET leida = 1, leida_at = NOW()
       WHERE id = ? AND empresa_id = ? AND usuario_id = ? AND leida = 0`,
      [id, empresaId, usuarioId]
    );
    return res.affectedRows;
  },

  async marcarTodasLeidas(empresaId, usuarioId) {
    const [res] = await pool.query(
      `UPDATE notificaciones SET leida = 1, leida_at = NOW()
       WHERE empresa_id = ? AND usuario_id = ? AND leida = 0`,
      [empresaId, usuarioId]
    );
    return res.affectedRows;
  },
};

module.exports = NotificacionesModel;
