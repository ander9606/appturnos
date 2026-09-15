'use strict';

const { pool } = require('../../config/database');

// latitud/longitud son DECIMAL — mysql2 los devuelve como string sin decimalNumbers.
// El cliente (LugarInput, MapaSelector, geofence) espera number y llama .toFixed()
// directo, así que sin este cast truena con "undefined is not a function".
function castCoords(row) {
  return { ...row, latitud: Number(row.latitud), longitud: Number(row.longitud) };
}

const PuntosMarcajeModel = {
  async listar(empresaId, { soloActivos = true } = {}) {
    const filtro = soloActivos ? 'AND activo = 1' : '';
    const [filas] = await pool.query(
      `SELECT id, empresa_id, nombre, descripcion, latitud, longitud,
              radio_metros, tipo, alcance, activo, created_at
       FROM puntos_marcaje
       WHERE empresa_id = ? ${filtro}
       ORDER BY tipo, nombre`,
      [empresaId]
    );
    return filas.map(castCoords);
  },

  /** Puntos disponibles como biblioteca de ubicaciones al crear un turno (alcance='todos'). */
  async listarParaTurnos(empresaId) {
    const [filas] = await pool.query(
      `SELECT id, nombre, latitud, longitud, radio_metros
       FROM puntos_marcaje
       WHERE empresa_id = ? AND alcance = 'todos' AND activo = 1
       ORDER BY nombre`,
      [empresaId]
    );
    return filas.map(castCoords);
  },

  async listarZonales(empresaId) {
    const [filas] = await pool.query(
      `SELECT id, nombre, latitud, longitud, radio_metros
       FROM puntos_marcaje
       WHERE empresa_id = ? AND tipo = 'zonal' AND activo = 1
       ORDER BY nombre`,
      [empresaId]
    );
    return filas.map(castCoords);
  },

  async obtenerPorId(empresaId, id) {
    const [filas] = await pool.query(
      `SELECT id, empresa_id, nombre, descripcion, latitud, longitud,
              radio_metros, tipo, alcance, activo, created_at
       FROM puntos_marcaje
       WHERE id = ? AND empresa_id = ? LIMIT 1`,
      [id, empresaId]
    );
    return filas[0] ? castCoords(filas[0]) : null;
  },

  async crear({ empresaId, nombre, descripcion, latitud, longitud, radio_metros, tipo, alcance }) {
    const [res] = await pool.query(
      `INSERT INTO puntos_marcaje
         (empresa_id, nombre, descripcion, latitud, longitud, radio_metros, tipo, alcance)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [empresaId, nombre, descripcion || null, latitud, longitud, radio_metros ?? 100, tipo ?? 'fijo', alcance ?? 'todos']
    );
    return res.insertId;
  },

  async actualizar(empresaId, id, cambios) {
    const sets = [];
    const params = [];
    const campos = ['nombre', 'descripcion', 'latitud', 'longitud', 'radio_metros', 'tipo', 'alcance', 'activo'];
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
