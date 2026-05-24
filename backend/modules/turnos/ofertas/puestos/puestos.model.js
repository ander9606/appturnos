'use strict';

const { pool } = require('../../../../config/database');

/**
 * Acceso a datos de `oferta_puestos`. Cada puesto es un slot
 * (cargo + plazas + tarifa) dentro de una oferta de turno.
 */

const COLUMNAS = `p.id, p.oferta_id, p.cargo_id, p.plazas, p.plazas_cubiertas,
                  p.tarifa_dia, p.notas, p.created_at,
                  c.codigo AS cargo_codigo, c.nombre AS cargo_nombre`;

const PuestosModel = {
  async listarPorOferta(ofertaId) {
    const [filas] = await pool.query(
      `SELECT ${COLUMNAS}
       FROM oferta_puestos p
       INNER JOIN cargos c ON c.id = p.cargo_id
       WHERE p.oferta_id = ?
       ORDER BY p.id`,
      [ofertaId]
    );
    return filas;
  },

  async obtenerPorId(id) {
    const [filas] = await pool.query(
      `SELECT ${COLUMNAS}
       FROM oferta_puestos p
       INNER JOIN cargos c ON c.id = p.cargo_id
       WHERE p.id = ? LIMIT 1`,
      [id]
    );
    return filas[0] || null;
  },

  /**
   * Crea un puesto. Conexión opcional para participar en transacciones
   * (ej. al crear la oferta junto con sus puestos).
   */
  async crear({ ofertaId, cargoId, plazas, tarifaDia, notas }, conn) {
    const runner = conn || pool;
    const [res] = await runner.query(
      `INSERT INTO oferta_puestos (oferta_id, cargo_id, plazas, tarifa_dia, notas)
       VALUES (?, ?, ?, ?, ?)`,
      [ofertaId, cargoId, plazas || 1, tarifaDia, notas || null]
    );
    return res.insertId;
  },

  async actualizar(id, cambios) {
    const sets = [];
    const params = [];
    if (cambios.plazas !== undefined) { sets.push('plazas = ?'); params.push(cambios.plazas); }
    if (cambios.tarifa_dia !== undefined) { sets.push('tarifa_dia = ?'); params.push(cambios.tarifa_dia); }
    if (cambios.notas !== undefined) { sets.push('notas = ?'); params.push(cambios.notas); }
    if (sets.length === 0) return 0;
    params.push(id);
    const [res] = await pool.query(
      `UPDATE oferta_puestos SET ${sets.join(', ')} WHERE id = ?`,
      params
    );
    return res.affectedRows;
  },

  async eliminar(id) {
    const [res] = await pool.query('DELETE FROM oferta_puestos WHERE id = ?', [id]);
    return res.affectedRows;
  },
};

module.exports = PuestosModel;
