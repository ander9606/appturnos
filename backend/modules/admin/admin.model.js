'use strict';

const { pool } = require('../../config/database');

/**
 * Acceso a datos del módulo admin (super_admin).
 * No filtra por empresa_id — opera a nivel de sistema.
 */
const AdminModel = {
  // ── Empresas ──────────────────────────────────────────────────────────────

  /** Lista todas las empresas con conteo de trabajadores y usuarios. */
  async listarEmpresas({ busqueda, activo, plan, limit, offset }) {
    const where = ['1=1'];
    const params = [];

    if (busqueda) {
      where.push('(e.nombre LIKE ? OR e.slug LIKE ? OR e.nit LIKE ?)');
      params.push(`%${busqueda}%`, `%${busqueda}%`, `%${busqueda}%`);
    }
    if (activo !== undefined) {
      where.push('e.activo = ?');
      params.push(activo ? 1 : 0);
    }
    if (plan) {
      where.push('e.plan = ?');
      params.push(plan);
    }

    const whereSql = where.join(' AND ');

    const [filas] = await pool.query(
      `SELECT
         e.id, e.nombre, e.slug, e.nit, e.ciudad, e.activo, e.plan,
         e.acepta_postulaciones, e.logo_url, e.descripcion, e.created_at,
         COUNT(DISTINCT t.id)  AS total_trabajadores,
         COUNT(DISTINCT u.id)  AS total_usuarios
       FROM empresas e
       LEFT JOIN trabajadores t ON t.empresa_id = e.id
       LEFT JOIN usuarios u     ON u.empresa_id = e.id
       WHERE ${whereSql}
       GROUP BY e.id
       ORDER BY e.nombre
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM empresas e WHERE ${whereSql}`,
      params
    );

    return { data: filas, total };
  },

  /** Detalle de una empresa con sus métricas. */
  async obtenerEmpresa(id) {
    const [filas] = await pool.query(
      `SELECT
         e.id, e.nombre, e.slug, e.nit, e.ciudad, e.activo, e.plan,
         e.acepta_postulaciones, e.logo_url, e.descripcion, e.created_at,
         COUNT(DISTINCT t.id)  AS total_trabajadores,
         COUNT(DISTINCT u.id)  AS total_usuarios,
         COUNT(DISTINCT ot.id) AS total_ofertas,
         COUNT(DISTINCT pn.id) AS total_periodos
       FROM empresas e
       LEFT JOIN trabajadores t  ON t.empresa_id = e.id
       LEFT JOIN usuarios u      ON u.empresa_id = e.id
       LEFT JOIN ofertas_turno ot ON ot.empresa_id = e.id
       LEFT JOIN periodos_nomina pn ON pn.empresa_id = e.id
       WHERE e.id = ?
       GROUP BY e.id
       LIMIT 1`,
      [id]
    );
    return filas[0] || null;
  },

  /** Crea una nueva empresa. Devuelve el id insertado. */
  async crearEmpresa({ nombre, slug, nit, ciudad, plan, descripcion }) {
    const [result] = await pool.query(
      `INSERT INTO empresas (nombre, slug, nit, ciudad, plan, descripcion)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [nombre, slug, nit || null, ciudad || null, plan || 'basico', descripcion || null]
    );
    return result.insertId;
  },

  /** Actualiza campos de una empresa. */
  async actualizarEmpresa(id, campos) {
    const permitidos = [
      'nombre', 'nit', 'ciudad', 'plan',
      'acepta_postulaciones', 'descripcion', 'logo_url',
    ];
    const sets = [];
    const vals = [];
    for (const [k, v] of Object.entries(campos)) {
      if (permitidos.includes(k)) {
        sets.push(`${k} = ?`);
        vals.push(v);
      }
    }
    if (sets.length === 0) return;
    vals.push(id);
    await pool.query(`UPDATE empresas SET ${sets.join(', ')} WHERE id = ?`, vals);
  },

  /** Activa o desactiva una empresa. */
  async cambiarEstado(id, activo) {
    await pool.query('UPDATE empresas SET activo = ? WHERE id = ?', [activo ? 1 : 0, id]);
  },

  /** Verifica si un slug ya existe (para validar unicidad al crear). */
  async existeSlug(slug, excluirId = null) {
    const params = [slug];
    let sql = 'SELECT id FROM empresas WHERE slug = ?';
    if (excluirId) {
      sql += ' AND id != ?';
      params.push(excluirId);
    }
    const [filas] = await pool.query(sql, params);
    return filas.length > 0;
  },

  // ── Reportes globales ─────────────────────────────────────────────────────

  /** Estadísticas globales del sistema. */
  async obtenerReportesGlobales() {
    const [[empresas]] = await pool.query(
      `SELECT
         COUNT(*)              AS total_empresas,
         SUM(activo = 1)       AS empresas_activas,
         SUM(activo = 0)       AS empresas_inactivas
       FROM empresas`
    );

    const [[usuarios]] = await pool.query(
      `SELECT COUNT(*) AS total_usuarios FROM usuarios WHERE rol != 'super_admin'`
    );

    const [[trabajadores]] = await pool.query(
      `SELECT
         COUNT(*)          AS total_trabajadores,
         SUM(activo = 1)   AS trabajadores_activos
       FROM trabajadores`
    );

    const [[turnos]] = await pool.query(
      `SELECT
         COUNT(*) AS total_turnos_mes
       FROM asignaciones_turno
       WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)`
    );

    const [[periodos]] = await pool.query(
      `SELECT
         COUNT(*) AS periodos_abiertos
       FROM periodos_nomina
       WHERE estado = 'abierto'`
    );

    const [planDist] = await pool.query(
      `SELECT plan, COUNT(*) AS total
       FROM empresas
       GROUP BY plan`
    );

    return {
      empresas: {
        total: Number(empresas.total_empresas),
        activas: Number(empresas.empresas_activas),
        inactivas: Number(empresas.empresas_inactivas),
      },
      usuarios: {
        total: Number(usuarios.total_usuarios),
      },
      trabajadores: {
        total: Number(trabajadores.total_trabajadores),
        activos: Number(trabajadores.trabajadores_activos),
      },
      turnos: {
        ultimo_mes: Number(turnos.total_turnos_mes),
      },
      nomina: {
        periodos_abiertos: Number(periodos.periodos_abiertos),
      },
      distribucion_planes: planDist.reduce((acc, row) => {
        acc[row.plan] = Number(row.total);
        return acc;
      }, {}),
    };
  },
};

module.exports = AdminModel;
