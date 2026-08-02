'use strict';

const { pool } = require('../../config/database');

/**
 * Acceso a datos del catálogo de cargos y de las asignaciones por trabajador.
 *
 * Modelo:
 *   - cargos.empresa_id IS NULL → cargo del sistema (visible a todas las empresas).
 *   - cargos.empresa_id = X     → cargo custom de la empresa X (solo visible para ella).
 *   - trabajador_cargos cuelga de trabajador_empresa.id (vínculo), no de usuario.
 */

const COLUMNAS = `c.id, c.empresa_id, c.codigo, c.nombre, c.descripcion,
                  c.tipo_geofence, c.punto_marcaje_id, c.activo, c.created_at`;

const CargosModel = {
  /**
   * Lista los cargos disponibles para una empresa: catálogo del sistema +
   * cargos custom de esa empresa. Excluye inactivos por default.
   */
  async listarParaEmpresa(empresaId, { incluirInactivos = false } = {}) {
    const filtroActivo = incluirInactivos ? '' : 'AND c.activo = 1';
    const [filas] = await pool.query(
      `SELECT ${COLUMNAS},
              CASE WHEN c.empresa_id IS NULL THEN 'sistema' ELSE 'empresa' END AS origen
       FROM cargos c
       WHERE (c.empresa_id IS NULL OR c.empresa_id = ?)
         ${filtroActivo}
       ORDER BY c.empresa_id IS NULL DESC, c.nombre`,
      [empresaId]
    );
    return filas;
  },

  async obtenerPorId(id) {
    const [filas] = await pool.query(
      `SELECT ${COLUMNAS} FROM cargos c WHERE c.id = ? LIMIT 1`,
      [id]
    );
    return filas[0] || null;
  },

  async obtenerPorCodigoEmpresa(codigo, empresaId) {
    const [filas] = await pool.query(
      `SELECT ${COLUMNAS} FROM cargos c
       WHERE c.codigo = ?
         AND (c.empresa_id <=> ?)
       LIMIT 1`,
      [codigo, empresaId]
    );
    return filas[0] || null;
  },

  async crear({ empresaId, codigo, nombre, descripcion, tipoGeofence, puntoMarcajeId }) {
    const [res] = await pool.query(
      `INSERT INTO cargos (empresa_id, codigo, nombre, descripcion, tipo_geofence, punto_marcaje_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [empresaId, codigo, nombre, descripcion || null, tipoGeofence || 'oferta', puntoMarcajeId || null]
    );
    return res.insertId;
  },

  async actualizar(id, { nombre, descripcion, activo, tipoGeofence, puntoMarcajeId }) {
    const sets = [];
    const params = [];
    if (nombre !== undefined) { sets.push('nombre = ?'); params.push(nombre); }
    if (descripcion !== undefined) { sets.push('descripcion = ?'); params.push(descripcion); }
    if (activo !== undefined) { sets.push('activo = ?'); params.push(activo ? 1 : 0); }
    if (tipoGeofence !== undefined) { sets.push('tipo_geofence = ?'); params.push(tipoGeofence); }
    if (puntoMarcajeId !== undefined) { sets.push('punto_marcaje_id = ?'); params.push(puntoMarcajeId || null); }
    if (sets.length === 0) return 0;
    params.push(id);
    const [res] = await pool.query(
      `UPDATE cargos SET ${sets.join(', ')} WHERE id = ?`,
      params
    );
    return res.affectedRows;
  },

  /** Cuántos trabajadores tienen este cargo asignado (para decidir hard vs soft delete). */
  async contarUsos(cargoId) {
    const [filas] = await pool.query(
      'SELECT COUNT(*) AS n FROM trabajador_cargos WHERE cargo_id = ?',
      [cargoId]
    );
    return filas[0]?.n || 0;
  },

  /**
   * Trabajadores activos de una empresa certificados para un cargo — usado
   * para advertir cuando una oferta pide más plazas de las que el catálogo
   * de la empresa puede cubrir.
   */
  async contarActivosPorEmpresa(cargoId, empresaId) {
    const [filas] = await pool.query(
      `SELECT COUNT(*) AS n
       FROM trabajador_cargos tc
       INNER JOIN trabajador_empresa te ON te.id = tc.trabajador_empresa_id
       WHERE tc.cargo_id = ? AND te.empresa_id = ? AND te.estado = 'activo'`,
      [cargoId, empresaId]
    );
    return filas[0]?.n || 0;
  },

  async eliminar(id) {
    const [res] = await pool.query('DELETE FROM cargos WHERE id = ?', [id]);
    return res.affectedRows;
  },

  // -------- Asignaciones (trabajador_cargos) --------

  /**
   * Lista los cargos asignados a un vínculo (trabajador_empresa).
   * Incluye datos del cargo para evitar N+1.
   */
  async listarPorVinculo(trabajadorEmpresaId) {
    const [filas] = await pool.query(
      `SELECT tc.id, tc.cargo_id, tc.asignado_por, tc.asignado_at,
              c.codigo, c.nombre, c.descripcion, c.empresa_id AS cargo_empresa_id
       FROM trabajador_cargos tc
       INNER JOIN cargos c ON c.id = tc.cargo_id
       WHERE tc.trabajador_empresa_id = ?
       ORDER BY c.nombre`,
      [trabajadorEmpresaId]
    );
    return filas;
  },

  /**
   * ¿Este vínculo tiene este cargo asignado? Usado al validar postulación
   * a un puesto de oferta (en PR-B) y al validar duplicados.
   */
  async tieneAsignacion(trabajadorEmpresaId, cargoId) {
    const [filas] = await pool.query(
      `SELECT id FROM trabajador_cargos
       WHERE trabajador_empresa_id = ? AND cargo_id = ?
       LIMIT 1`,
      [trabajadorEmpresaId, cargoId]
    );
    return filas.length > 0;
  },

  async asignar({ trabajadorEmpresaId, cargoId, asignadoPor }) {
    const [res] = await pool.query(
      `INSERT INTO trabajador_cargos (trabajador_empresa_id, cargo_id, asignado_por)
       VALUES (?, ?, ?)`,
      [trabajadorEmpresaId, cargoId, asignadoPor]
    );
    return res.insertId;
  },

  async desasignar(trabajadorEmpresaId, cargoId) {
    const [res] = await pool.query(
      `DELETE FROM trabajador_cargos
       WHERE trabajador_empresa_id = ? AND cargo_id = ?`,
      [trabajadorEmpresaId, cargoId]
    );
    return res.affectedRows;
  },

  // -------- Funciones por cargo (cargo_funciones) --------
  // Se guardan por (cargo_id, empresa_id): un cargo de sistema puede tener un
  // listado de funciones distinto en cada empresa que lo usa.

  async listarFunciones(cargoId, empresaId) {
    const [filas] = await pool.query(
      `SELECT id, descripcion, orden
       FROM cargo_funciones
       WHERE cargo_id = ? AND empresa_id = ?
       ORDER BY orden, id`,
      [cargoId, empresaId]
    );
    return filas;
  },

  /** Reemplaza el listado completo de funciones de un cargo para una empresa. */
  async reemplazarFunciones(cargoId, empresaId, descripciones) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      await conn.query('DELETE FROM cargo_funciones WHERE cargo_id = ? AND empresa_id = ?', [cargoId, empresaId]);
      if (descripciones.length > 0) {
        const values = descripciones.map((d, i) => [cargoId, empresaId, d, i]);
        await conn.query(
          'INSERT INTO cargo_funciones (cargo_id, empresa_id, descripcion, orden) VALUES ?',
          [values]
        );
      }
      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
    return CargosModel.listarFunciones(cargoId, empresaId);
  },
};

module.exports = CargosModel;
