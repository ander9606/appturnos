'use strict';

const { pool } = require('../../config/database');

/**
 * Acceso a datos de trabajadores.
 * Todas las consultas se filtran por empresa_id (aislamiento multi-tenant).
 */

// Columnas que se devuelven al cliente (se omite cualquier dato sensible).
const COLUMNAS = `id, empresa_id, usuario_id, nombre, apellido, cedula, telefono,
  email, tipo, cargo, tarifa_hora, salario_base, activo, external_ref,
  ranking, total_calificaciones, created_at`;

// Allowlist de columnas modificables vía PUT. Es una lista fija de código,
// no claves de entrada del usuario, por lo que es seguro interpolarla en SQL.
const CAMPOS_EDITABLES = [
  'nombre',
  'apellido',
  'cedula',
  'telefono',
  'email',
  'tipo',
  'cargo',
  'tarifa_hora',
  'salario_base',
  'external_ref',
];

const TrabajadoresModel = {
  /**
   * Lista paginada con filtros opcionales por tipo y estado.
   * @returns {Promise<{data: object[], total: number}>}
   */
  async listar(empresaId, { tipo, activo, limit, offset }) {
    const where = ['empresa_id = ?'];
    const params = [empresaId];
    if (tipo) {
      where.push('tipo = ?');
      params.push(tipo);
    }
    if (activo !== undefined) {
      where.push('activo = ?');
      params.push(activo ? 1 : 0);
    }
    const whereSql = where.join(' AND ');

    const [filas] = await pool.query(
      `SELECT ${COLUMNAS} FROM trabajadores
       WHERE ${whereSql}
       ORDER BY apellido, nombre
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );
    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM trabajadores WHERE ${whereSql}`,
      params
    );
    return { data: filas, total };
  },

  async obtenerPorId(empresaId, id) {
    const [filas] = await pool.query(
      `SELECT ${COLUMNAS} FROM trabajadores
       WHERE id = ? AND empresa_id = ? LIMIT 1`,
      [id, empresaId]
    );
    return filas[0] || null;
  },

  /** Trabajador activo vinculado a una cuenta de usuario (para acciones del propio trabajador). */
  async obtenerPorUsuarioId(empresaId, usuarioId) {
    // Workers marketplace (logiq360) tienen empresa_id=null en el JWT.
    // En ese caso buscamos solo por usuario_id sin filtrar empresa.
    const [filas] = empresaId != null
      ? await pool.query(
          `SELECT ${COLUMNAS} FROM trabajadores
           WHERE usuario_id = ? AND empresa_id = ? AND activo = 1 LIMIT 1`,
          [usuarioId, empresaId]
        )
      : await pool.query(
          `SELECT ${COLUMNAS} FROM trabajadores
           WHERE usuario_id = ? AND activo = 1 LIMIT 1`,
          [usuarioId]
        );
    return filas[0] || null;
  },

  /** Trabajador por referencia externa (sincronización con logiq360). */
  async obtenerPorExternalRef(empresaId, externalRef) {
    const [filas] = await pool.query(
      `SELECT ${COLUMNAS} FROM trabajadores
       WHERE external_ref = ? AND empresa_id = ? LIMIT 1`,
      [externalRef, empresaId]
    );
    return filas[0] || null;
  },

  /** Inserta un trabajador y devuelve su id. */
  async crear(empresaId, datos) {
    const [res] = await pool.query(
      `INSERT INTO trabajadores
         (empresa_id, nombre, apellido, cedula, telefono, email, tipo,
          cargo, tarifa_hora, salario_base, external_ref)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        empresaId,
        datos.nombre,
        datos.apellido,
        datos.cedula ?? null,
        datos.telefono ?? null,
        datos.email ?? null,
        datos.tipo || 'turnos',
        datos.cargo ?? null,
        datos.tarifa_hora ?? null,
        datos.salario_base ?? null,
        datos.external_ref ?? null,
      ]
    );
    return res.insertId;
  },

  /**
   * Actualiza solo los campos presentes en `datos` (PUT parcial).
   * @returns {Promise<number>} filas afectadas.
   */
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
      `UPDATE trabajadores SET ${sets.join(', ')} WHERE id = ? AND empresa_id = ?`,
      params
    );
    return res.affectedRows;
  },

  /** Soft delete: marca activo = 0. */
  async desactivar(empresaId, id) {
    const [res] = await pool.query(
      'UPDATE trabajadores SET activo = 0 WHERE id = ? AND empresa_id = ?',
      [id, empresaId]
    );
    return res.affectedRows;
  },
};

module.exports = TrabajadoresModel;
