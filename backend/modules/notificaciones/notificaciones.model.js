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

  /** Listado del usuario + total y conteo de no leídas.
   *  empresaId puede ser null para trabajadores marketplace — en ese caso
   *  se omite el filtro de empresa y el worker ve sus notificaciones de
   *  cualquier empresa (las que le enviaron al confirmarle un turno, etc).
   */
  async listar(empresaId, usuarioId, { soloNoLeidas, limit, offset }) {
    const where = ['usuario_id = ?'];
    const params = [usuarioId];
    if (empresaId != null) {
      where.push('empresa_id = ?');
      params.push(empresaId);
    }
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
    // no_leidas count uses same empresa filter for consistency
    const noLeidasWhere = empresaId != null
      ? 'usuario_id = ? AND empresa_id = ? AND leida = 0'
      : 'usuario_id = ? AND leida = 0';
    const noLeidasParams = empresaId != null ? [usuarioId, empresaId] : [usuarioId];
    const [[{ no_leidas }]] = await pool.query(
      `SELECT COUNT(*) AS no_leidas FROM notificaciones WHERE ${noLeidasWhere}`,
      noLeidasParams
    );
    return { data: filas, total, no_leidas };
  },

  async marcarLeida(empresaId, usuarioId, id) {
    // For marketplace workers (empresaId = null), match by id + usuario_id only
    const where = empresaId != null
      ? 'id = ? AND empresa_id = ? AND usuario_id = ? AND leida = 0'
      : 'id = ? AND usuario_id = ? AND leida = 0';
    const params = empresaId != null ? [id, empresaId, usuarioId] : [id, usuarioId];
    const [res] = await pool.query(
      `UPDATE notificaciones SET leida = 1, leida_at = NOW() WHERE ${where}`,
      params
    );
    return res.affectedRows;
  },

  async marcarTodasLeidas(empresaId, usuarioId) {
    const where = empresaId != null
      ? 'empresa_id = ? AND usuario_id = ? AND leida = 0'
      : 'usuario_id = ? AND leida = 0';
    const params = empresaId != null ? [empresaId, usuarioId] : [usuarioId];
    const [res] = await pool.query(
      `UPDATE notificaciones SET leida = 1, leida_at = NOW() WHERE ${where}`,
      params
    );
    return res.affectedRows;
  },
};

module.exports = NotificacionesModel;
