'use strict';

const { pool } = require('../../../config/database');

/**
 * Modelo para periodos_turnos: sincroniza pago de turnos con liquidación de nómina.
 *
 * Tipos de período:
 * - semanal: 7 días
 * - quincenal: 15 días (valor default, sincronizado con nómina)
 * - mensual: ~30 días
 * - trimestral: 90 días (para turnos extras de trabajador_nomina)
 */

const COLUMNAS = `id, empresa_id, fecha_inicio, fecha_fin, tipo, es_extra_nomina, estado,
  cerrado_por, cerrado_at, created_at`;

const PeriodosTurnosModel = {
  /**
   * Crear o actualizar un período. Si ya existe para esas fechas, devuelve el existente.
   */
  async crearOActualizar(empresaId, { fechaInicio, fechaFin, tipo, esExtraNomina = 0 }) {
    const connection = await pool.getConnection();
    try {
      // Buscar si ya existe
      const [existente] = await connection.query(
        `SELECT id FROM periodos_turnos
         WHERE empresa_id = ? AND fecha_inicio = ? AND fecha_fin = ? AND es_extra_nomina = ?`,
        [empresaId, fechaInicio, fechaFin, esExtraNomina]
      );

      if (existente.length > 0) {
        return { id: existente[0].id, esNuevo: false };
      }

      // Crear uno nuevo
      const [resultado] = await connection.query(
        `INSERT INTO periodos_turnos (empresa_id, fecha_inicio, fecha_fin, tipo, es_extra_nomina)
         VALUES (?, ?, ?, ?, ?)`,
        [empresaId, fechaInicio, fechaFin, tipo, esExtraNomina]
      );
      return { id: resultado.insertId, esNuevo: true };
    } finally {
      connection.release();
    }
  },

  async obtenerPorId(empresaId, id) {
    const [[row]] = await pool.query(
      `SELECT ${COLUMNAS} FROM periodos_turnos
       WHERE id = ? AND empresa_id = ?`,
      [id, empresaId]
    );
    return row || null;
  },

  /**
   * Listar períodos de turnos de una empresa.
   */
  async listar(empresaId, { estado, fechaDesde, fechaHasta, esExtraNomina, limit = 50, offset = 0 }) {
    const where = ['empresa_id = ?'];
    const params = [empresaId];

    if (estado) {
      where.push('estado = ?');
      params.push(estado);
    }
    if (esExtraNomina !== undefined) {
      where.push('es_extra_nomina = ?');
      params.push(esExtraNomina ? 1 : 0);
    }
    if (fechaDesde) {
      where.push('fecha_fin >= ?');
      params.push(fechaDesde);
    }
    if (fechaHasta) {
      where.push('fecha_inicio <= ?');
      params.push(fechaHasta);
    }

    const whereSql = where.join(' AND ');

    const [filas] = await pool.query(
      `SELECT ${COLUMNAS} FROM periodos_turnos
       WHERE ${whereSql}
       ORDER BY fecha_inicio DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM periodos_turnos WHERE ${whereSql}`,
      params
    );

    return { data: filas, total };
  },

  /**
   * Encontrar el período activo (abierto) que contiene una fecha dada.
   */
  async obtenerPorFecha(empresaId, fecha, esExtraNomina = 0) {
    const [[row]] = await pool.query(
      `SELECT ${COLUMNAS} FROM periodos_turnos
       WHERE empresa_id = ? AND fecha_inicio <= ? AND fecha_fin >= ?
         AND estado = 'abierto' AND es_extra_nomina = ?`,
      [empresaId, fecha, fecha, esExtraNomina]
    );
    return row || null;
  },

  /**
   * Cerrar un período (transición: abierto → cerrado).
   * Retorna el período cerrado.
   */
  async cerrar(empresaId, id, usuarioId) {
    const ahora = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const [resultado] = await pool.query(
      `UPDATE periodos_turnos
       SET estado = 'cerrado', cerrado_por = ?, cerrado_at = ?
       WHERE id = ? AND empresa_id = ?`,
      [usuarioId, ahora, id, empresaId]
    );
    if (resultado.affectedRows === 0) {
      throw new Error('Período no encontrado o no está abierto');
    }
    return this.obtenerPorId(empresaId, id);
  },

  /**
   * Liquidar un período (transición: cerrado → liquidado).
   * Esto marca que el pago fue procesado.
   */
  async liquidar(empresaId, id) {
    const [resultado] = await pool.query(
      `UPDATE periodos_turnos
       SET estado = 'liquidado'
       WHERE id = ? AND empresa_id = ? AND estado = 'cerrado'`,
      [id, empresaId]
    );
    if (resultado.affectedRows === 0) {
      throw new Error('Período no encontrado o no está cerrado');
    }
    return this.obtenerPorId(empresaId, id);
  },

  /**
   * Vincular asignaciones completadas a un período de pago.
   * Se ejecuta al cerrar el período.
   */
  async asignarAsignacionesAlPeriodo(empresaId, periodoId, { esExtraNomina = 0 }) {
    const [periodo] = await pool.query(
      `SELECT fecha_inicio, fecha_fin FROM periodos_turnos
       WHERE id = ? AND empresa_id = ?`,
      [periodoId, empresaId]
    );
    if (!periodo.length) throw new Error('Período no encontrado');

    const { fecha_inicio, fecha_fin } = periodo[0];

    // Marcar asignaciones completadas en el rango como vinculadas a este período
    // Si es extra_nomina, solo turnos de trabajador_nomina; si no, solo otros
    const tipoTrabajador = esExtraNomina ? 'nomina' : 'no_nomina';
    const [resultado] = await pool.query(
      `UPDATE asignaciones_turno a
       JOIN ofertas_turno o ON o.id = a.oferta_id
       JOIN trabajadores t ON t.id = a.trabajador_id
       SET a.periodo_pago_id = ?
       WHERE a.empresa_id = ?
         AND a.estado = 'completado'
         AND o.fecha >= ? AND o.fecha <= ?
         AND ${esExtraNomina ? "t.tipo = 'nomina'" : "t.tipo != 'nomina'"}
         AND a.periodo_pago_id IS NULL`,
      [periodoId, empresaId, fecha_inicio, fecha_fin]
    );
    return resultado;
  },
};

module.exports = PeriodosTurnosModel;
