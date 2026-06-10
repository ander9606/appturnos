'use strict';

const { pool } = require('../../config/database');

/**
 * Acceso a datos de la relación trabajador ↔ empresa (tabla trabajador_empresa).
 * Implementa el doble opt-in: trabajador solicita → empresa aprueba,
 * o empresa invita → trabajador acepta.
 */

const COLUMNAS = `te.id, te.usuario_id, te.empresa_id, te.trabajador_id,
  te.estado, te.iniciado_por, te.fecha_solicitud, te.fecha_resuelto,
  te.motivo_rechazo,
  e.nombre AS empresa_nombre, e.slug AS empresa_slug, e.logo_url AS empresa_logo,
  e.ciudad AS empresa_ciudad`;

const TrabajadorEmpresaModel = {
  async obtenerPorId(id) {
    const [filas] = await pool.query(
      `SELECT ${COLUMNAS}
       FROM trabajador_empresa te
       INNER JOIN empresas e ON e.id = te.empresa_id
       WHERE te.id = ? LIMIT 1`,
      [id]
    );
    return filas[0] || null;
  },

  async obtenerPorUsuarioEmpresa(usuarioId, empresaId) {
    const [filas] = await pool.query(
      `SELECT ${COLUMNAS}
       FROM trabajador_empresa te
       INNER JOIN empresas e ON e.id = te.empresa_id
       WHERE te.usuario_id = ? AND te.empresa_id = ? LIMIT 1`,
      [usuarioId, empresaId]
    );
    return filas[0] || null;
  },

  /** Todas las relaciones de un trabajador (para "Mis empresas").
   *  Las activas incluyen ranking y total_calificaciones de esa empresa concreta.
   */
  async listarPorUsuario(usuarioId) {
    const [filas] = await pool.query(
      `SELECT ${COLUMNAS},
              ROUND(AVG(ct.calificacion), 2) AS ranking,
              COUNT(ct.id)                   AS total_calificaciones
       FROM trabajador_empresa te
       INNER JOIN empresas e ON e.id = te.empresa_id
       LEFT JOIN calificaciones_turno ct
              ON ct.empresa_id    = te.empresa_id
             AND ct.trabajador_id = te.trabajador_id
       WHERE te.usuario_id = ?
       GROUP BY te.id
       ORDER BY te.fecha_solicitud DESC`,
      [usuarioId]
    );
    return filas;
  },

  /** Solicitudes pendientes para una empresa (panel del jefe de turnos). */
  async listarPorEmpresa(empresaId, estado) {
    const params = [empresaId];
    let estadoSql = '';
    if (estado) {
      estadoSql = 'AND te.estado = ?';
      params.push(estado);
    } else {
      // Por defecto solo las pendientes (ambos sentidos).
      estadoSql = "AND te.estado IN ('solicitado_por_trabajador', 'solicitado_por_empresa')";
    }
    const [filas] = await pool.query(
      `SELECT te.id, te.usuario_id, te.empresa_id, te.trabajador_id,
              te.estado, te.iniciado_por, te.fecha_solicitud,
              u.nombre AS usuario_nombre, u.apellido AS usuario_apellido,
              u.email AS usuario_email
       FROM trabajador_empresa te
       INNER JOIN usuarios u ON u.id = te.usuario_id
       WHERE te.empresa_id = ? ${estadoSql}
       ORDER BY te.fecha_solicitud DESC`,
      params
    );
    return filas;
  },

  /**
   * Empresas activas del trabajador con su ranking en cada una.
   * Usado para calcular el delay de visibilidad de ofertas por empresa.
   */
  async listarActivasConRanking(usuarioId) {
    const [filas] = await pool.query(
      `SELECT te.empresa_id, t.ranking, t.id AS trabajador_id
       FROM trabajador_empresa te
       LEFT JOIN trabajadores t ON t.id = te.trabajador_id AND t.activo = 1
       WHERE te.usuario_id = ? AND te.estado = 'activo'`,
      [usuarioId]
    );
    return filas;
  },

  /** Solo los IDs de empresas activas (para el filtro IN de ofertas). */
  async listarEmpresaIds(usuarioId) {
    const [filas] = await pool.query(
      `SELECT empresa_id FROM trabajador_empresa
       WHERE usuario_id = ? AND estado = 'activo'`,
      [usuarioId]
    );
    return filas.map((f) => f.empresa_id);
  },

  async crear({ usuarioId, empresaId, estado, iniciadoPor }) {
    const [res] = await pool.query(
      `INSERT INTO trabajador_empresa
         (usuario_id, empresa_id, estado, iniciado_por)
       VALUES (?, ?, ?, ?)`,
      [usuarioId, empresaId, estado, iniciadoPor]
    );
    return res.insertId;
  },

  async cambiarEstado(id, estado, { motivo, trabajadorId, fechaResuelto } = {}) {
    const sets = ['estado = ?'];
    const params = [estado];

    if (motivo !== undefined) {
      sets.push('motivo_rechazo = ?');
      params.push(motivo);
    }
    if (trabajadorId !== undefined) {
      sets.push('trabajador_id = ?');
      params.push(trabajadorId);
    }
    if (estado !== 'solicitado_por_trabajador' && estado !== 'solicitado_por_empresa') {
      sets.push('fecha_resuelto = ?');
      params.push(fechaResuelto ?? new Date());
    }

    params.push(id);
    const [res] = await pool.query(
      `UPDATE trabajador_empresa SET ${sets.join(', ')} WHERE id = ?`,
      params
    );
    return res.affectedRows;
  },
};

module.exports = TrabajadorEmpresaModel;
