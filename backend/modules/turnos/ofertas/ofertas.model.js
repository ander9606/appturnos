'use strict';

const { pool } = require('../../../config/database');

/**
 * Acceso a datos de ofertas de turno (tabla ofertas_turno).
 * Todas las consultas se aíslan por empresa_id.
 */

const COLUMNAS = `id, empresa_id, titulo, descripcion, fecha, hora_inicio, hora_fin_estimada,
  lugar, latitud, longitud, plazas_disponibles, plazas_cubiertas, tarifa_dia, estado,
  external_ref, creado_por, created_at`;

// Allowlist de columnas modificables vía PUT (lista fija de código).
const CAMPOS_EDITABLES = [
  'titulo',
  'descripcion',
  'fecha',
  'hora_inicio',
  'hora_fin_estimada',
  'lugar',
  'latitud',
  'longitud',
  'plazas_disponibles',
  'tarifa_dia',
];

const OfertasModel = {
  async listar(empresaId, { fecha, estado, disponibles, limit, offset }) {
    const where = ['empresa_id = ?'];
    const params = [empresaId];
    if (fecha) {
      where.push('fecha = ?');
      params.push(fecha);
    }
    if (estado) {
      where.push('estado = ?');
      params.push(estado);
    }
    if (disponibles) {
      where.push("estado = 'abierta' AND plazas_cubiertas < plazas_disponibles");
    }
    const whereSql = where.join(' AND ');

    const [filas] = await pool.query(
      `SELECT ${COLUMNAS} FROM ofertas_turno
       WHERE ${whereSql}
       ORDER BY fecha DESC, hora_inicio
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );
    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM ofertas_turno WHERE ${whereSql}`,
      params
    );
    return { data: filas, total };
  },

  async obtenerPorId(empresaId, id) {
    const [filas] = await pool.query(
      `SELECT ${COLUMNAS} FROM ofertas_turno WHERE id = ? AND empresa_id = ? LIMIT 1`,
      [id, empresaId]
    );
    return filas[0] || null;
  },

  async crear(empresaId, datos, creadoPor) {
    const [res] = await pool.query(
      `INSERT INTO ofertas_turno
         (empresa_id, titulo, descripcion, fecha, hora_inicio, hora_fin_estimada,
          lugar, latitud, longitud, plazas_disponibles, tarifa_dia, creado_por)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        empresaId,
        datos.titulo,
        datos.descripcion ?? null,
        datos.fecha,
        datos.hora_inicio,
        datos.hora_fin_estimada ?? null,
        datos.lugar ?? null,
        datos.latitud ?? null,
        datos.longitud ?? null,
        datos.plazas_disponibles ?? 1,
        datos.tarifa_dia,
        creadoPor,
      ]
    );
    return res.insertId;
  },

  /** Actualiza solo los campos presentes (PUT parcial). */
  async actualizar(empresaId, id, datos) {
    const sets = [];
    const params = [];
    for (const campo of CAMPOS_EDITABLES) {
      if (datos[campo] !== undefined) {
        sets.push(`${campo} = ?`);
        params.push(datos[campo]);
      }
    }
    if (sets.length === 0) return 0;

    params.push(id, empresaId);
    const [res] = await pool.query(
      `UPDATE ofertas_turno SET ${sets.join(', ')} WHERE id = ? AND empresa_id = ?`,
      params
    );
    return res.affectedRows;
  },

  /**
   * Cancela la oferta y, en la misma transacción, cancela sus asignaciones
   * que aún no estén completadas ni canceladas.
   */
  async cancelar(empresaId, id) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      await conn.query(
        "UPDATE ofertas_turno SET estado = 'cancelada' WHERE id = ? AND empresa_id = ?",
        [id, empresaId]
      );
      await conn.query(
        `UPDATE asignaciones_turno SET estado = 'cancelado'
         WHERE oferta_id = ? AND empresa_id = ?
           AND estado NOT IN ('completado', 'cancelado')`,
        [id, empresaId]
      );
      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  },
};

module.exports = OfertasModel;
