'use strict';

const { pool } = require('../../config/database');

const COLUMNAS_PUBLICAS = `id, nombre, slug, ciudad, plan,
  logo_url, descripcion, acepta_postulaciones, created_at`;

const COLUMNAS_ADMIN = `id, nombre, slug, nit, ciudad, plan, actividad,
  logo_url, descripcion, telefono, email_empresa, direccion, acepta_postulaciones,
  tipo_liquidacion, tipo_contrato, created_at`;

const EmpresasModel = {
  async listarDirectorio({ busqueda, ciudad, limit, offset }) {
    const where = ['activo = 1', 'acepta_postulaciones = 1'];
    const params = [];
    if (busqueda) {
      where.push('(nombre LIKE ? OR slug LIKE ?)');
      params.push(`%${busqueda}%`, `%${busqueda}%`);
    }
    if (ciudad) {
      // LIKE, no "=" — el campo ciudad es texto libre (mi-empresa.tsx), así que
      // "Bogotá D.C." o "bogota" no calzaban con el chip fijo "Bogotá" y la
      // empresa quedaba invisible en el directorio para ese filtro.
      where.push('ciudad LIKE ?');
      params.push(`%${ciudad}%`);
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

    // Cargos visibles en el directorio — solo informativo, para que el
    // trabajador sepa qué roles tiene la empresa antes de solicitar vínculo.
    // La empresa sigue eligiendo qué cargo(s) asignarle al aprobar (solicitudes.tsx).
    const empresaIds = filas.map((f) => f.id);
    if (empresaIds.length > 0) {
      const [cargoFilas] = await pool.query(
        `SELECT id, nombre, empresa_id FROM cargos
         WHERE activo = 1 AND (empresa_id IS NULL OR empresa_id IN (?))
         ORDER BY nombre`,
        [empresaIds]
      );
      const sistema = cargoFilas.filter((c) => c.empresa_id === null).map(({ id, nombre }) => ({ id, nombre }));
      const porEmpresa = new Map();
      for (const c of cargoFilas) {
        if (c.empresa_id === null) continue;
        if (!porEmpresa.has(c.empresa_id)) porEmpresa.set(c.empresa_id, []);
        porEmpresa.get(c.empresa_id).push({ id: c.id, nombre: c.nombre });
      }
      for (const f of filas) {
        f.cargos = [...sistema, ...(porEmpresa.get(f.id) ?? [])].sort((a, b) => a.nombre.localeCompare(b.nombre));
      }
    }

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
    const CAMPOS = ['nombre', 'nit', 'ciudad', 'descripcion', 'actividad', 'logo_url', 'telefono', 'email_empresa', 'direccion', 'acepta_postulaciones', 'tipo_liquidacion', 'tipo_contrato'];
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

  async obtenerTipoContrato(empresaId) {
    const [filas] = await pool.query(
      'SELECT tipo_contrato FROM empresas WHERE id = ? AND activo = 1 LIMIT 1',
      [empresaId]
    );
    return filas[0]?.tipo_contrato || 'laboral';
  },

  async obtenerParaPago(empresaId) {
    const [filas] = await pool.query(
      'SELECT id, nombre FROM empresas WHERE id = ? AND activo = 1 LIMIT 1',
      [empresaId]
    );
    return filas[0] || null;
  },

  async contarTrabajadoresActivos(empresaId) {
    const [[{ total }]] = await pool.query(
      'SELECT COUNT(*) AS total FROM trabajadores WHERE empresa_id = ? AND activo = 1',
      [empresaId]
    );
    return Number(total);
  },

  async obtenerEstadoSuscripcion(empresaId) {
    const [filas] = await pool.query(
      'SELECT plan, suscripcion_vigente_hasta FROM empresas WHERE id = ? AND activo = 1 LIMIT 1',
      [empresaId]
    );
    return filas[0] || null;
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
