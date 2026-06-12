'use strict';

const { pool } = require('../../config/database');

const COLUMNAS_PUBLICAS = `id, nombre, slug, ciudad, plan,
  logo_url, descripcion, acepta_postulaciones, created_at`;

const COLUMNAS_ADMIN = `id, nombre, slug, nit, ciudad, plan, actividad,
  logo_url, descripcion, acepta_postulaciones, created_at`;

const EmpresasModel = {
  async listarDirectorio({ busqueda, ciudad, limit, offset }) {
    const where = ['activo = 1', 'acepta_postulaciones = 1'];
    const params = [];
    if (busqueda) {
      where.push('(nombre LIKE ? OR slug LIKE ?)');
      params.push(`%${busqueda}%`, `%${busqueda}%`);
    }
    if (ciudad) {
      where.push('ciudad = ?');
      params.push(ciudad);
    }
    const whereSql = where.join(' AND ');
    const [filas] = await pool.query(
      `SELECT ${COLUMNAS_PUBLICAS} FROM empresas WHERE ${whereSql} ORDER BY nombre LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );
    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM empresas WHERE ${whereSql}`,
      params
    );
    return { data: filas, total };
  },

  async obtenerDetalle(empresaId) {
    const [filas] = await pool.query(
      `SELECT ${COLUMNAS_PUBLICAS} FROM empresas WHERE id = ? AND activo = 1 LIMIT 1`,
      [empresaId]
    );
    return filas[0] || null;
  },

  async obtenerParaAdmin(empresaId) {
    const [filas] = await pool.query(
      `SELECT ${COLUMNAS_ADMIN} FROM empresas WHERE id = ? AND activo = 1 LIMIT 1`,
      [empresaId]
    );
    return filas[0] || null;
  },

  async actualizarPorAdmin(empresaId, datos) {
    const CAMPOS = ['nombre', 'nit', 'ciudad', 'descripcion', 'actividad', 'logo_url', 'acepta_postulaciones'];
    const sets = [];
    const params = [];
    for (const campo of CAMPOS) {
      if (datos[campo] !== undefined) {
        sets.push(`${campo} = ?`);
        params.push(datos[campo]);
      }
    }
    if (sets.length === 0) return 0;
    params.push(empresaId);
    const [res] = await pool.query(
      `UPDATE empresas SET ${sets.join(', ')} WHERE id = ? AND activo = 1`,
      params
    );
    return res.affectedRows;
  },

  async obtenerPorSlug(slug) {
    const [filas] = await pool.query(
      'SELECT id, nombre, slug, activo FROM empresas WHERE slug = ? LIMIT 1',
      [slug]
    );
    return filas[0] || null;
  },
};

module.exports = EmpresasModel;
