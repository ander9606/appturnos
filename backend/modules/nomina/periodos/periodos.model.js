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

  /**
   * Cierra el período Y congela el valor_hora de cada trabajador
   * en todos sus registros_diarios del período, en una sola transacción.
   *
   * Prioridad del sueldo (igual que laboralUtils.valorHora):
   *   1. tarifa_hora      — tarifa directa por hora
   *   2. salario_base/240 — derivada del mensual (30 días × 8 h)
   *   3. 0               — trabajador sin sueldo configurado
   *
   * Usar este método en lugar de `cerrar` garantiza que cualquier
   * modificación de sueldo posterior no afecte períodos ya cerrados.
   */
  async cerrarConSnapshot(empresaId, periodoId, cerradoPor) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      // 1. Cambiar estado del período
      await conn.query(
        `UPDATE periodos_nomina
         SET estado = 'cerrado', cerrado_por = ?, cerrado_at = NOW()
         WHERE id = ? AND empresa_id = ?`,
        [cerradoPor, periodoId, empresaId],
      );

      // 2. Congelar valor_hora en todos los registros del período.
      //    240 = HORAS_MES_NOMINA (30 días × 8 h, ley laboral colombiana).
      await conn.query(
        `UPDATE registros_diarios r
         JOIN  trabajadores t ON t.id = r.trabajador_id
         SET   r.valor_hora_snapshot = CASE
                 WHEN t.tarifa_hora  IS NOT NULL THEN t.tarifa_hora
                 WHEN t.salario_base IS NOT NULL THEN t.salario_base / 240
                 ELSE 0
               END
         WHERE r.periodo_id = ? AND r.empresa_id = ?`,
        [periodoId, empresaId],
      );

      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  },

  /** Returns open periods whose fecha_fin is strictly before the given date. */
  async listarAbiertosVencidos(empresaId, fecha) {
    const [filas] = await pool.query(
      `SELECT ${COLUMNAS} FROM periodos_nomina
       WHERE empresa_id = ? AND estado = 'abierto' AND fecha_fin < ?`,
      [empresaId, fecha]
    );
    return filas;
  },

  async obtenerAbiertoPorFecha(empresaId, fecha) {
    const [filas] = await pool.query(
      `SELECT ${COLUMNAS} FROM periodos_nomina
       WHERE empresa_id = ? AND estado = 'abierto'
         AND fecha_inicio <= ? AND fecha_fin >= ?
       LIMIT 1`,
      [empresaId, fecha, fecha]
    );
    return filas[0] || null;
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
