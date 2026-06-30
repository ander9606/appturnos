'use strict';

const { pool } = require('../../config/database');

const AusenciasModel = {
  async listar(empresaId, { estado, trabajadorId, limit, offset }) {
    const where = ['empresa_id = ?'];
    const params = [empresaId];
    if (estado)       { where.push('estado = ?');        params.push(estado); }
    if (trabajadorId) { where.push('trabajador_id = ?'); params.push(trabajadorId); }

    const [filas] = await pool.query(
      `SELECT a.*, t.nombre AS trabajador_nombre, t.apellido AS trabajador_apellido
       FROM ausencias a
       JOIN trabajadores t ON t.id = a.trabajador_id
       WHERE ${where.join(' AND ')}
       ORDER BY a.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );
    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM ausencias WHERE ${where.join(' AND ')}`,
      params
    );
    return { data: filas, total };
  },

  async listarPorTrabajador(empresaId, trabajadorId, { limit, offset }) {
    const [filas] = await pool.query(
      `SELECT * FROM ausencias WHERE empresa_id = ? AND trabajador_id = ?
       ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [empresaId, trabajadorId, limit, offset]
    );
    const [[{ total }]] = await pool.query(
      'SELECT COUNT(*) AS total FROM ausencias WHERE empresa_id = ? AND trabajador_id = ?',
      [empresaId, trabajadorId]
    );
    return { data: filas, total };
  },

  async crear(empresaId, trabajadorId, datos) {
    const [res] = await pool.query(
      `INSERT INTO ausencias (empresa_id, trabajador_id, tipo, fecha_inicio, fecha_fin, motivo)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [empresaId, trabajadorId, datos.tipo, datos.fecha_inicio, datos.fecha_fin, datos.motivo ?? null]
    );
    return res.insertId;
  },

  async obtenerPorId(empresaId, id) {
    const [[fila]] = await pool.query(
      'SELECT * FROM ausencias WHERE id = ? AND empresa_id = ? LIMIT 1',
      [id, empresaId]
    );
    return fila ?? null;
  },

  async actualizarEstado(empresaId, id, estado, aprobadoPor) {
    const [res] = await pool.query(
      `UPDATE ausencias SET estado = ?, aprobado_por = ?, aprobado_at = NOW()
       WHERE id = ? AND empresa_id = ? AND estado = 'pendiente'`,
      [estado, aprobadoPor, id, empresaId]
    );
    return res.affectedRows;
  },

  async contarPendientes(empresaId) {
    const [[{ total }]] = await pool.query(
      "SELECT COUNT(*) AS total FROM ausencias WHERE empresa_id = ? AND estado = 'pendiente'",
      [empresaId]
    );
    return total;
  },
};

module.exports = AusenciasModel;