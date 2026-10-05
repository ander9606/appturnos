'use strict';

const { pool } = require('../../../config/database');

/** Acceso a datos de descuentos por turno (tabla descuentos_turno). */
const DescuentosTurnoModel = {
  async crear(empresaId, { asignacionId, trabajadorId, monto, motivo, creadoPor }) {
    const [res] = await pool.query(
      `INSERT INTO descuentos_turno (empresa_id, asignacion_id, trabajador_id, monto, motivo, creado_por)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [empresaId, asignacionId, trabajadorId, monto, motivo, creadoPor]
    );
    return res.insertId;
  },

  /** empresaId null: trabajador_turnos multi-empresa — el id ya es único globalmente. */
  async obtenerPorId(empresaId, id) {
    const [filas] = await pool.query(
      `SELECT d.id, d.empresa_id, d.asignacion_id, d.trabajador_id, d.monto, d.motivo,
              d.estado, d.creado_por, d.respondido_at, d.created_at,
              t.usuario_id AS trabajador_usuario_id
       FROM descuentos_turno d
       JOIN trabajadores t ON t.id = d.trabajador_id
       WHERE d.id = ?${empresaId != null ? ' AND d.empresa_id = ?' : ''} LIMIT 1`,
      empresaId != null ? [id, empresaId] : [id]
    );
    return filas[0] || null;
  },

  async listarPorAsignacion(empresaId, asignacionId, { estado = null } = {}) {
    const [filas] = await pool.query(
      `SELECT id, monto, motivo, estado, respondido_at, created_at
       FROM descuentos_turno
       WHERE empresa_id = ? AND asignacion_id = ?${estado ? ' AND estado = ?' : ''}
       ORDER BY id`,
      estado ? [empresaId, asignacionId, estado] : [empresaId, asignacionId]
    );
    return filas;
  },

  /** Lo que ya está comprometido en el turno: pendientes + aceptados (los rechazados no cuentan). */
  async sumaComprometida(empresaId, asignacionId) {
    const [[fila]] = await pool.query(
      `SELECT COALESCE(SUM(monto), 0) AS total
       FROM descuentos_turno
       WHERE empresa_id = ? AND asignacion_id = ? AND estado IN ('pendiente', 'aceptado')`,
      [empresaId, asignacionId]
    );
    return Number(fila.total);
  },

  /** Solo desde 'pendiente': evita responder dos veces el mismo descuento. */
  async responder(empresaId, id, estado) {
    const [res] = await pool.query(
      `UPDATE descuentos_turno SET estado = ?, respondido_at = NOW()
       WHERE id = ? AND empresa_id = ? AND estado = 'pendiente'`,
      [estado, id, empresaId]
    );
    return res.affectedRows;
  },

  async eliminar(empresaId, id) {
    const [res] = await pool.query(
      'DELETE FROM descuentos_turno WHERE id = ? AND empresa_id = ?',
      [id, empresaId]
    );
    return res.affectedRows;
  },
};

module.exports = DescuentosTurnoModel;
