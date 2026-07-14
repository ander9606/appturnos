'use strict';

const { pool } = require('../../config/database');

const COLS = 'id, empresa_id, segmento, tipo, fecha_inicio, fecha_fin, estado, created_at';

const TurnosEventualModel = {
  async obtenerPorId(empresaId, id) {
    const [[row]] = await pool.query(
      `SELECT ${COLS} FROM periodos_turno_eventual WHERE id = ? AND empresa_id = ? LIMIT 1`,
      [id, empresaId]
    );
    return row || null;
  },

  async obtenerActivo(empresaId, segmento, fechaInicio) {
    const [[row]] = await pool.query(
      `SELECT ${COLS} FROM periodos_turno_eventual
       WHERE empresa_id = ? AND segmento = ? AND fecha_inicio = ? LIMIT 1`,
      [empresaId, segmento, fechaInicio]
    );
    return row || null;
  },

  async crear(empresaId, { segmento, tipo, fecha_inicio, fecha_fin }) {
    const [res] = await pool.query(
      `INSERT INTO periodos_turno_eventual (empresa_id, segmento, tipo, fecha_inicio, fecha_fin)
       VALUES (?, ?, ?, ?, ?)`,
      [empresaId, segmento, tipo, fecha_inicio, fecha_fin]
    );
    return res.insertId;
  },

  async liquidar(empresaId, id) {
    const [res] = await pool.query(
      `UPDATE periodos_turno_eventual SET estado = 'liquidado'
       WHERE id = ? AND empresa_id = ?`,
      [id, empresaId]
    );
    return res.affectedRows;
  },

  /** paraQuien: valores de ofertas_turno.para_quien que cuentan para el segmento del período. */
  async liquidacion(empresaId, periodoId, paraQuien) {
    const [filas] = await pool.query(
      `SELECT
         t.id AS trabajador_id,
         CONCAT(t.nombre, ' ', t.apellido) AS nombre_completo,
         COUNT(a.id)        AS turnos,
         SUM(a.horas_trabajadas)  AS horas,
         SUM(a.pago_total)  AS total
       FROM asignaciones_turno a
       JOIN ofertas_turno      o ON o.id = a.oferta_id
       JOIN trabajadores       t ON t.id = a.trabajador_id
       JOIN periodos_turno_eventual p ON p.id = ?
       WHERE a.empresa_id = ?
         AND a.estado = 'completado'
         AND o.para_quien IN (?)
         AND o.fecha BETWEEN p.fecha_inicio AND p.fecha_fin
       GROUP BY t.id, t.nombre, t.apellido
       ORDER BY total DESC`,
      [periodoId, empresaId, paraQuien]
    );
    return filas;
  },
};

module.exports = TurnosEventualModel;
