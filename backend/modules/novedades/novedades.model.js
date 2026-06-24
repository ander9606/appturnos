'use strict';

const { pool } = require('../../config/database');

const NovedadesModel = {
  async getByAsignacion(empresaId, asignacionId) {
    const [filas] = await pool.query(
      `SELECT n.*, u.nombre AS autor_nombre, u.apellido AS autor_apellido
       FROM novedades n
       JOIN usuarios u ON u.id = n.autor_id
       WHERE n.empresa_id = ? AND n.asignacion_id = ?
       ORDER BY n.created_at ASC`,
      [empresaId, asignacionId]
    );
    return filas;
  },

  async create(empresaId, asignacionId, autorId, tipo, descripcion) {
    const [res] = await pool.query(
      `INSERT INTO novedades (empresa_id, asignacion_id, autor_id, tipo, descripcion)
       VALUES (?, ?, ?, ?, ?)`,
      [empresaId, asignacionId, autorId, tipo, descripcion]
    );
    const [filas] = await pool.query(
      `SELECT n.*, u.nombre AS autor_nombre, u.apellido AS autor_apellido
       FROM novedades n
       JOIN usuarios u ON u.id = n.autor_id
       WHERE n.id = ?`,
      [res.insertId]
    );
    return filas[0];
  },

  /** Retorna el trabajador_id y los usuarios gestores de la empresa para la asignación. */
  async getParticipantes(empresaId, asignacionId) {
    const [[asignacion]] = await pool.query(
      `SELECT a.trabajador_id,
              t.usuario_id AS trabajador_usuario_id
       FROM asignaciones_turno a
       JOIN trabajadores t ON t.id = a.trabajador_id
       WHERE a.id = ? AND a.empresa_id = ?`,
      [asignacionId, empresaId]
    );
    if (!asignacion) return [];

    const [gestores] = await pool.query(
      `SELECT id FROM usuarios
       WHERE empresa_id = ? AND rol IN ('admin_empresa','jefe_turnos') AND activo = 1`,
      [empresaId]
    );

    const ids = new Set(gestores.map((g) => g.id));
    if (asignacion.trabajador_usuario_id) ids.add(asignacion.trabajador_usuario_id);
    return [...ids];
  },
};

module.exports = NovedadesModel;
