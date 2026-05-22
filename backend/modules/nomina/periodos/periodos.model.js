'use strict';

const { pool } = require('../../../config/database');

/** Acceso a datos de períodos de nómina (tabla periodos_nomina). */

const COLUMNAS = `id, empresa_id, fecha_inicio, fecha_fin, tipo, estado,
  cerrado_por, cerrado_at, created_at`;

const PeriodosModel = {
  async listar(empresaId, { estado, limit, offset }) {
    const where = ['empresa_id = ?'];
    const params = [empresaId];
    if (estado) {
      where.push('estado = ?');
      params.push(estado);
    }
    const whereSql = where.join(' AND ');

    const [filas] = await pool.query(
      `SELECT ${COLUMNAS} FROM periodos_nomina
       WHERE ${whereSql}
       ORDER BY fecha_inicio DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );
    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM periodos_nomina WHERE ${whereSql}`,
      params
    );
    return { data: filas, total };
  },

  async obtenerPorId(empresaId, id) {
    const [filas] = await pool.query(
      `SELECT ${COLUMNAS} FROM periodos_nomina WHERE id = ? AND empresa_id = ? LIMIT 1`,
      [id, empresaId]
    );
    return filas[0] || null;
  },

  async crear(empresaId, { fecha_inicio, fecha_fin, tipo }) {
    const [res] = await pool.query(
      `INSERT INTO periodos_nomina (empresa_id, fecha_inicio, fecha_fin, tipo)
       VALUES (?, ?, ?, ?)`,
      [empresaId, fecha_inicio, fecha_fin, tipo || 'quincenal']
    );
    return res.insertId;
  },

  async cerrar(empresaId, id, cerradoPor) {
    const [res] = await pool.query(
      `UPDATE periodos_nomina
       SET estado = 'cerrado', cerrado_por = ?, cerrado_at = NOW()
       WHERE id = ? AND empresa_id = ?`,
      [cerradoPor, id, empresaId]
    );
    return res.affectedRows;
  },

  async liquidar(empresaId, id) {
    const [res] = await pool.query(
      "UPDATE periodos_nomina SET estado = 'liquidado' WHERE id = ? AND empresa_id = ?",
      [id, empresaId]
    );
    return res.affectedRows;
  },
};

module.exports = PeriodosModel;
