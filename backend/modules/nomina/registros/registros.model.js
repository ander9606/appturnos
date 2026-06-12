'use strict';

const { pool } = require('../../../config/database');

/** Acceso a datos de registros diarios de nómina (tabla registros_diarios). */
const RegistrosModel = {
  async listar(empresaId, { periodoId, trabajadorId, fecha, limit, offset }) {
    const where = ['r.empresa_id = ?'];
    const params = [empresaId];
    if (periodoId) {
      where.push('r.periodo_id = ?');
      params.push(periodoId);
    }
    if (trabajadorId) {
      where.push('r.trabajador_id = ?');
      params.push(trabajadorId);
    }
    if (fecha) {
      where.push('r.fecha = ?');
      params.push(fecha);
    }
    const whereSql = where.join(' AND ');

    const [filas] = await pool.query(
      `SELECT r.*, t.nombre AS trabajador_nombre, t.apellido AS trabajador_apellido
       FROM registros_diarios r
       JOIN trabajadores t ON t.id = r.trabajador_id
       WHERE ${whereSql}
       ORDER BY r.fecha DESC, t.apellido
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );
    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM registros_diarios r WHERE ${whereSql}`,
      params
    );
    return { data: filas, total };
  },

  async obtenerPorId(empresaId, id) {
    const [filas] = await pool.query(
      'SELECT * FROM registros_diarios WHERE id = ? AND empresa_id = ? LIMIT 1',
      [id, empresaId]
    );
    return filas[0] || null;
  },

  async obtenerPorFecha(empresaId, trabajadorId, fecha) {
    const [filas] = await pool.query(
      'SELECT * FROM registros_diarios WHERE empresa_id = ? AND trabajador_id = ? AND fecha = ? LIMIT 1',
      [empresaId, trabajadorId, fecha]
    );
    return filas[0] || null;
  },

  async crear(empresaId, d) {
    const [res] = await pool.query(
      `INSERT INTO registros_diarios
         (empresa_id, trabajador_id, periodo_id, fecha, hora_entrada, hora_salida,
          horas_ordinarias, horas_extra_diurnas, horas_extra_nocturnas, horas_nocturnas,
          horas_festivo, es_festivo, novedad, tipo_dia)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        empresaId,
        d.trabajador_id,
        d.periodo_id,
        d.fecha,
        d.hora_entrada,
        d.hora_salida,
        d.horas_ordinarias,
        d.horas_extra_diurnas,
        d.horas_extra_nocturnas,
        d.horas_nocturnas,
        d.horas_festivo,
        d.es_festivo,
        d.novedad,
        d.tipo_dia || 'ordinario',
      ]
    );
    return res.insertId;
  },

  /** INSERT for real-time clock-in: only hora_entrada, hours start at 0. */
  async crearConEntrada(empresaId, d) {
    const [res] = await pool.query(
      `INSERT INTO registros_diarios
         (empresa_id, trabajador_id, periodo_id, fecha, hora_entrada,
          horas_ordinarias, horas_extra_diurnas, horas_extra_nocturnas,
          horas_nocturnas, horas_festivo, es_festivo)
       VALUES (?, ?, ?, ?, ?, 0, 0, 0, 0, 0, 0)`,
      [empresaId, d.trabajador_id, d.periodo_id, d.fecha, d.hora_entrada]
    );
    return res.insertId;
  },

  /** Set hora_entrada on an existing registro that has none yet (race-condition safe). */
  async actualizarEntrada(empresaId, id, horaEntrada) {
    const [res] = await pool.query(
      `UPDATE registros_diarios SET hora_entrada = ?
       WHERE id = ? AND empresa_id = ? AND hora_entrada IS NULL`,
      [horaEntrada, id, empresaId]
    );
    return res.affectedRows;
  },

  /** Set hora_salida + recalculated hours. Guard: only when salida still NULL. */
  async actualizarSalida(empresaId, id, d) {
    const [res] = await pool.query(
      `UPDATE registros_diarios SET
         hora_salida = ?, horas_ordinarias = ?, horas_extra_diurnas = ?,
         horas_extra_nocturnas = ?, horas_nocturnas = ?, horas_festivo = ?, es_festivo = ?
       WHERE id = ? AND empresa_id = ? AND hora_salida IS NULL`,
      [
        d.hora_salida,
        d.horas_ordinarias,
        d.horas_extra_diurnas,
        d.horas_extra_nocturnas,
        d.horas_nocturnas,
        d.horas_festivo,
        d.es_festivo,
        id,
        empresaId,
      ]
    );
    return res.affectedRows;
  },

  /** Reemplaza los campos recalculables del registro (corrección). */
  async actualizar(empresaId, id, d) {
    const [res] = await pool.query(
      `UPDATE registros_diarios SET
         hora_entrada = ?, hora_salida = ?, horas_ordinarias = ?, horas_extra_diurnas = ?,
         horas_extra_nocturnas = ?, horas_nocturnas = ?, horas_festivo = ?, es_festivo = ?,
         novedad = ?, tipo_dia = ?, aprobado_por = ?
       WHERE id = ? AND empresa_id = ?`,
      [
        d.hora_entrada,
        d.hora_salida,
        d.horas_ordinarias,
        d.horas_extra_diurnas,
        d.horas_extra_nocturnas,
        d.horas_nocturnas,
        d.horas_festivo,
        d.es_festivo,
        d.novedad,
        d.tipo_dia,
        d.aprobado_por,
        id,
        empresaId,
      ]
    );
    return res.affectedRows;
  },
};

module.exports = RegistrosModel;
