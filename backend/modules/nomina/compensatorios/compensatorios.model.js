'use strict';

const { pool } = require('../../../config/database');

const CompensatoriosModel = {
  /** Crea un descanso compensatorio pendiente. Ignora duplicados (misma empresa + registro). */
  async crear(empresaId, { trabajadorId, periodoId, origenFecha, origenRegistroId }) {
    const [res] = await pool.query(
      `INSERT IGNORE INTO descansos_compensatorios
         (empresa_id, trabajador_id, periodo_id, origen_fecha, origen_registro_id)
       VALUES (?, ?, ?, ?, ?)`,
      [empresaId, trabajadorId, periodoId, origenFecha, origenRegistroId]
    );
    return res.insertId || null;
  },

  /** Lista compensatorios con datos del trabajador. Filtrable por trabajador y estado. */
  async listar(empresaId, { trabajadorId, estado } = {}) {
    const where = ['dc.empresa_id = ?'];
    const params = [empresaId];
    if (trabajadorId) { where.push('dc.trabajador_id = ?'); params.push(trabajadorId); }
    if (estado)       { where.push('dc.estado = ?');        params.push(estado); }

    const [filas] = await pool.query(
      `SELECT dc.*,
              t.nombre   AS trabajador_nombre,
              t.apellido AS trabajador_apellido
       FROM descansos_compensatorios dc
       JOIN trabajadores t ON t.id = dc.trabajador_id
       WHERE ${where.join(' AND ')}
       ORDER BY dc.origen_fecha DESC`,
      params
    );
    return filas;
  },

  async obtenerPorId(empresaId, id) {
    const [filas] = await pool.query(
      'SELECT * FROM descansos_compensatorios WHERE id = ? AND empresa_id = ? LIMIT 1',
      [id, empresaId]
    );
    return filas[0] || null;
  },

  /** Asigna una fecha al descanso compensatorio. */
  async asignar(empresaId, id, { fechaAsignada, asignadoPor }) {
    const [res] = await pool.query(
      `UPDATE descansos_compensatorios
       SET estado = 'asignado', fecha_asignada = ?, asignado_por = ?, asignado_en = NOW()
       WHERE id = ? AND empresa_id = ? AND estado = 'pendiente'`,
      [fechaAsignada, asignadoPor, id, empresaId]
    );
    return res.affectedRows;
  },

  /** Marca como tomado (cuando se registra ese día como compensatorio en registros_diarios). */
  async marcarTomado(empresaId, id) {
    await pool.query(
      `UPDATE descansos_compensatorios SET estado = 'tomado'
       WHERE id = ? AND empresa_id = ? AND estado = 'asignado'`,
      [id, empresaId]
    );
  },
};

module.exports = CompensatoriosModel;
