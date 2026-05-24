'use strict';

const { pool } = require('../../config/database');

/**
 * Acceso a datos de empresas — enfocado en el directorio público
 * que los trabajadores-turnos usan para encontrar empleadores.
 */

const COLUMNAS_PUBLICAS = `id, nombre, slug, ciudad, plan,
  logo_url, descripcion, acepta_postulaciones, created_at`;

const EmpresasModel = {
  /**
   * Lista empresas que aceptan postulaciones (directorio público).
   * Opcionalmente filtra por nombre o ciudad.
   */
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
      `SELECT ${COLUMNAS_PUBLICAS} FROM empresas
       WHERE ${whereSql}
       ORDER BY nombre
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );
    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM empresas WHERE ${whereSql}`,
      params
    );
    return { data: filas, total };
  },

  /**
   * Detalle público de una empresa.
   * Solo muestra empresas activas (independientemente de acepta_postulaciones).
   */
  async obtenerDetalle(empresaId) {
    const [filas] = await pool.query(
      `SELECT ${COLUMNAS_PUBLICAS} FROM empresas
       WHERE id = ? AND activo = 1 LIMIT 1`,
      [empresaId]
    );
    return filas[0] || null;
  },

  /** Busca una empresa por slug (para activar cuenta con X-Empresa-Slug). */
  async obtenerPorSlug(slug) {
    const [filas] = await pool.query(
      'SELECT id, nombre, slug, activo FROM empresas WHERE slug = ? LIMIT 1',
      [slug]
    );
    return filas[0] || null;
  },
};

module.exports = EmpresasModel;
