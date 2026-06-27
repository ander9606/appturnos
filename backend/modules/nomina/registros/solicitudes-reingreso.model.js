'use strict';

const { pool } = require('../../../config/database');

const SolicitudesReingresoModel = {
  async crear(empresaId, registroId, trabajadorId, motivo) {
    const [res] = await pool.query(
      `INSERT INTO solicitudes_reingreso (empresa_id, registro_id, trabajador_id, motivo)
       VALUES (?, ?, ?, ?)`,
      [empresaId, registroId, trabajadorId, motivo || null]
    );
    return res.insertId;
  },

  /** La solicitud activa (pendiente o aprobada) para un registro del día. */
  async obtenerActivaPorRegistro(empresaId, registroId) {
    const [filas] = await pool.query(
      `SELECT * FROM solicitudes_reingreso
       WHERE empresa_id = ? AND registro_id = ? AND estado IN ('pendiente','aprobado')
       ORDER BY created_at DESC LIMIT 1`,
      [empresaId, registroId]
    );
    return filas[0] || null;
  },

  /** Lista todas las pendientes de la empresa con datos del trabajador. */
  async listarPendientes(empresaId) {
    const [filas] = await pool.query(
      `SELECT sr.*,
              t.nombre AS trabajador_nombre, t.apellido AS trabajador_apellido,
              r.fecha, r.hora_entrada, r.hora_salida
       FROM solicitudes_reingreso sr
       JOIN trabajadores t ON t.id = sr.trabajador_id
       JOIN registros_diarios r ON r.id = sr.registro_id
       WHERE sr.empresa_id = ? AND sr.estado = 'pendiente'
       ORDER BY sr.created_at`,
      [empresaId]
    );
    return filas;
  },

  async aprobar(empresaId, id, gestorId) {
    const [res] = await pool.query(
      `UPDATE solicitudes_reingreso
       SET estado = 'aprobado', aprobado_por = ?, aprobado_at = NOW()
       WHERE id = ? AND empresa_id = ? AND estado = 'pendiente'`,
      [gestorId, id, empresaId]
    );
    return res.affectedRows;
  },

  async rechazar(empresaId, id, gestorId) {
    const [res] = await pool.query(
      `UPDATE solicitudes_reingreso
       SET estado = 'rechazado', aprobado_por = ?, aprobado_at = NOW()
       WHERE id = ? AND empresa_id = ? AND estado = 'pendiente'`,
      [gestorId, id, empresaId]
    );
    return res.affectedRows;
  },

  async marcarUsada(id) {
    await pool.query(
      "UPDATE solicitudes_reingreso SET estado = 'usado' WHERE id = ?",
      [id]
    );
  },
};

module.exports = SolicitudesReingresoModel;
