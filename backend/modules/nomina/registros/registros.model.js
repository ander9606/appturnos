'use strict';

const { pool } = require('../../../config/database');

/** Acceso a datos de registros diarios de nómina (tabla registros_diarios). */
const RegistrosModel = {
  async listar(empresaId, { periodoId, trabajadorId, fecha, fechaDesde, fechaHasta, limit, offset }) {
    const where = ['r.empresa_id = ?'];
    const params = [empresaId];
    if (periodoId)   { where.push('r.periodo_id = ?');    params.push(periodoId); }
    if (trabajadorId){ where.push('r.trabajador_id = ?'); params.push(trabajadorId); }
    if (fecha)       { where.push('r.fecha = ?');         params.push(fecha); }
    if (fechaDesde)  { where.push('r.fecha >= ?');        params.push(fechaDesde); }
    if (fechaHasta)  { where.push('r.fecha <= ?');        params.push(fechaHasta); }
    const whereSql = where.join(' AND ');

    const [filas] = await pool.query(
      `SELECT r.*, t.nombre AS trabajador_nombre, t.apellido AS trabajador_apellido,
              sr.estado AS reingreso_estado
       FROM registros_diarios r
       JOIN trabajadores t ON t.id = r.trabajador_id
       LEFT JOIN solicitudes_reingreso sr
         ON sr.id = (
           SELECT id FROM solicitudes_reingreso
           WHERE registro_id = r.id AND estado IN ('pendiente','aprobado')
           ORDER BY created_at DESC LIMIT 1
         )
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
      `SELECT r.*, sr.estado AS reingreso_estado
       FROM registros_diarios r
       LEFT JOIN solicitudes_reingreso sr
         ON sr.id = (
           SELECT id FROM solicitudes_reingreso
           WHERE registro_id = r.id AND estado IN ('pendiente','aprobado')
           ORDER BY created_at DESC LIMIT 1
         )
       WHERE r.empresa_id = ? AND r.trabajador_id = ? AND r.fecha = ?
       LIMIT 1`,
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
         (empresa_id, trabajador_id, periodo_id, fecha, hora_entrada, hora_entrada_inicial,
          horas_ordinarias, horas_extra_diurnas, horas_extra_nocturnas,
          horas_nocturnas, horas_festivo, es_festivo)
       VALUES (?, ?, ?, ?, ?, ?, 0, 0, 0, 0, 0, 0)`,
      [empresaId, d.trabajador_id, d.periodo_id, d.fecha, d.hora_entrada, d.hora_entrada]
    );
    return res.insertId;
  },

  /**
   * Inicia una nueva sesión del día tras un reingreso aprobado.
   * Los horas_* acumuladas de la sesión anterior se preservan;
   * hora_entrada se resetea a la nueva entrada y hora_salida se limpia.
   */
  async iniciarReingreso(empresaId, id, horaEntrada) {
    const [res] = await pool.query(
      `UPDATE registros_diarios
       SET hora_entrada = ?, hora_salida = NULL, sesiones = sesiones + 1
       WHERE id = ? AND empresa_id = ? AND hora_salida IS NOT NULL`,
      [horaEntrada, id, empresaId]
    );
    return res.affectedRows;
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

  /**
   * Suma horas ordinarias y extras de la semana actual (lunes → antes de hoy).
   * Las horas festivo NO se cuentan en la semana en que se trabajaron; en cambio
   * se acreditan en la semana en que se toma el compensatorio (fecha_asignada).
   */
  async sumarOrdinariasEnSemana(empresaId, trabajadorId, fechaLunes, fechaHoy) {
    const [[work]] = await pool.query(
      `SELECT COALESCE(SUM(horas_ordinarias + horas_nocturnas), 0)          AS ordinarias,
              COALESCE(SUM(horas_extra_diurnas + horas_extra_nocturnas), 0) AS extras
       FROM registros_diarios
       WHERE empresa_id = ? AND trabajador_id = ?
         AND fecha >= ? AND fecha < ?
         AND hora_salida IS NOT NULL`,
      [empresaId, trabajadorId, fechaLunes, fechaHoy]
    );
    // Horas del festivo original acreditadas esta semana vía compensatorio tomado/asignado
    const [[comp]] = await pool.query(
      `SELECT COALESCE(SUM(r.horas_festivo), 0) AS horas_comp
       FROM descansos_compensatorios dc
       JOIN registros_diarios r ON r.id = dc.origen_registro_id
       WHERE dc.empresa_id = ? AND dc.trabajador_id = ?
         AND dc.fecha_asignada >= ? AND dc.fecha_asignada < ?
         AND dc.estado IN ('asignado', 'tomado')`,
      [empresaId, trabajadorId, fechaLunes, fechaHoy]
    );
    return {
      ordinarias: Number(work.ordinarias) + Number(comp.horas_comp),
      extras:     Number(work.extras),
    };
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
