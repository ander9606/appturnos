'use strict';

const { pool } = require('../../../config/database');

const DescuentosModel = {
  async crear(empresaId, { trabajadorId, periodoId, tipo, motivo, monto, creadoPor }) {
    const [res] = await pool.query(
      `INSERT INTO descuentos_nomina
         (empresa_id, trabajador_id, periodo_id, tipo, motivo, monto, creado_por)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [empresaId, trabajadorId, periodoId, tipo, motivo, monto, creadoPor]
    );
    return res.insertId;
  },

  /** Lista descuentos con datos del trabajador. Filtrable por trabajador, período y estado. */
  async listar(empresaId, { trabajadorId, periodoId, estado } = {}) {
    const where = ['d.empresa_id = ?'];
    const params = [empresaId];
    if (trabajadorId) { where.push('d.trabajador_id = ?'); params.push(trabajadorId); }
    if (periodoId)     { where.push('d.periodo_id = ?');     params.push(periodoId); }
    if (estado)        { where.push('d.estado = ?');         params.push(estado); }

    const [filas] = await pool.query(
      `SELECT d.*, t.nombre AS trabajador_nombre, t.apellido AS trabajador_apellido
       FROM descuentos_nomina d
       JOIN trabajadores t ON t.id = d.trabajador_id
       WHERE ${where.join(' AND ')}
       ORDER BY d.created_at DESC`,
      params
    );
    return filas;
  },

  /** Suma de descuentos aceptados por trabajador en un período — para la liquidación. */
  async aceptadosPorPeriodo(empresaId, periodoId) {
    const [filas] = await pool.query(
      `SELECT id, trabajador_id, tipo, motivo, monto
       FROM descuentos_nomina
       WHERE empresa_id = ? AND periodo_id = ? AND estado = 'aceptado'`,
      [empresaId, periodoId]
    );
    return filas;
  },

  async obtenerPorId(empresaId, id) {
    const [filas] = await pool.query(
      'SELECT * FROM descuentos_nomina WHERE id = ? AND empresa_id = ? LIMIT 1',
      [id, empresaId]
    );
    return filas[0] || null;
  },

  async responder(empresaId, id, estado) {
    const [res] = await pool.query(
      `UPDATE descuentos_nomina SET estado = ?, respondido_at = NOW()
       WHERE id = ? AND empresa_id = ? AND estado = 'pendiente'`,
      [estado, id, empresaId]
    );
    return res.affectedRows;
  },

  async eliminar(empresaId, id) {
    const [res] = await pool.query(
      'DELETE FROM descuentos_nomina WHERE id = ? AND empresa_id = ?',
      [id, empresaId]
    );
    return res.affectedRows;
  },
};

module.exports = DescuentosModel;
