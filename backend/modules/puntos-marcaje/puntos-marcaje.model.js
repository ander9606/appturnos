'use strict';

const { pool } = require('../../config/database');

const PuntosMarcajeModel = {
  async listar(empresaId, { soloActivos = true } = {}) {
    const filtro = soloActivos ? 'AND activo = 1' : '';
    const [filas] = await pool.query(
      `SELECT id, empresa_id, nombre, descripcion, latitud, longitud,
              radio_metros, tipo, activo, created_at
       FROM puntos_marcaje
       WHERE empresa_id = ? ${filtro}
       ORDER BY tipo, nombre`,
      [empresaId]
    );
    return filas;
  },

  async listarZonales(empresaId) {
    const [filas] = await pool.query(
      `SELECT id, nombre, latitud, longitud, radio_metros
       FROM puntos_marcaje
       WHERE empresa_id = ? AND tipo = 'zonal' AND activo = 1
       ORDER BY nombre`,
      [empresaId]
    );
    return filas;
  },

  async obtenerPorId(empresaId, id) {
    const [filas] = await pool.query(
      `SELECT id, empresa_id, nombre, descripcion, latitud, longitud,
              radio_metros, tipo, activo, created_at
       FROM puntos_marcaje
       WHERE id = ? AND empresa_id = ? LIMIT 1`,
      [id, empresaId]
    );
    return filas[0] || null;
  },

  async crear({ empresaId, nombre, descripcion, latitud, longitud, radio_metros, tipo }) {
    const [res] = await pool.query(
      `INSERT INTO puntos_marcaje
         (empresa_id, nombre, descripcion, latitud, longitud, radio_metros, tipo)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [empresaId, nombre, descripcion || null, latitud, longitud, radio_metros ?? 100, tipo ?? 'fijo']
    );
    return res.insertId;
  },

  async actualizar(empresaId, id, cambios) {
    const sets = [];
    const params = [];
    const campos = ['nombre', 'descripcion', 'latitud', 'longitud', 'radio_metros', 'tipo', 'activo'];
    for (const c of campos) {
      if (cambios[c] !== undefined) {
        sets.push(`${c} = ?`);
        params.push(cambios[c]);
      }
    }
    if (sets.length === 0) return 0;
    params.push(id, empresaId);
    const [res] = await pool.query(
      `UPDATE puntos_marcaje SET ${sets.join(', ')} WHERE id = ? AND empresa_id = ?`,
      params
    );
    return res.affectedRows;
  },

  async eliminar(empresaId, id) {
    const [res] = await pool.query(
      'DELETE FROM puntos_marcaje WHERE id = ? AND empresa_id = ?',
      [id, empresaId]
    );
    return res.affectedRows;
  },

  /** Cuenta cargos Y trabajadores (marcación 'fijo') que apuntan a este punto — la FK de trabajadores es ON DELETE SET NULL, así que sin este chequeo el borrado los deja huérfanos en silencio. */
  async contarUsos(id) {
    const [filas] = await pool.query(
      `SELECT
         (SELECT COUNT(*) FROM cargos WHERE punto_marcaje_id = ?) +
         (SELECT COUNT(*) FROM trabajadores WHERE punto_marcaje_id = ?) AS n`,
      [id, id]
    );
    return filas[0]?.n || 0;
  },
};

module.exports = PuntosMarcajeModel;
