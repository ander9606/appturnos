'use strict';

const { pool } = require('../../config/database');

// Tabla `wompi_eventos` (cola de pagos) + lecturas/escrituras de `empresas` que
// dispara un pago. Es de plataforma: no filtra por empresa_id del request.
const WompiModel = {
  /** Persiste el evento. `nuevo` es false si el transaction_id ya existía (idempotencia). */
  async insertarEvento({ transactionId, referencia, empresaId, plan, meses, payload }) {
    const [ins] = await pool.query(
      `INSERT IGNORE INTO wompi_eventos
         (transaction_id, referencia, empresa_id, plan, meses, estado, payload)
       VALUES (?, ?, ?, ?, ?, 'recibido', ?)`,
      [transactionId, referencia, empresaId, plan, meses, JSON.stringify(payload)]
    );
    return { nuevo: ins.affectedRows > 0, id: ins.insertId };
  },

  async activarSuscripcion(empresaId, plan, meses) {
    await pool.query(
      `UPDATE empresas
          SET plan                      = ?,
              suscripcion_vigente_hasta = DATE_ADD(
                GREATEST(COALESCE(suscripcion_vigente_hasta, CURDATE()), CURDATE()),
                INTERVAL ? MONTH
              ),
              suscripcion_origen        = 'wompi'
        WHERE id = ? AND activo = 1`,
      [plan, meses, empresaId]
    );
  },

  async marcarProcesado(eventoId) {
    await pool.query(
      `UPDATE wompi_eventos
          SET estado = 'procesado', procesado_at = NOW(), intentos = intentos + 1
        WHERE id = ?`,
      [eventoId]
    );
  },

  async marcarError(eventoId, detalle) {
    await pool.query(
      `UPDATE wompi_eventos SET estado = 'error', intentos = intentos + 1, error_detalle = ? WHERE id = ?`,
      [detalle, eventoId]
    );
  },

  async marcarRechazado(eventoId) {
    await pool.query(`UPDATE wompi_eventos SET estado = 'rechazado' WHERE id = ?`, [eventoId]);
  },

  async marcarIgnorado(eventoId) {
    await pool.query(`UPDATE wompi_eventos SET estado = 'ignorado' WHERE id = ?`, [eventoId]);
  },

  /** Evento en estado 'error' (o undefined si no existe / ya no está en error). */
  async obtenerEnError(eventoId) {
    const [[ev]] = await pool.query(
      `SELECT id, empresa_id, plan, meses, payload FROM wompi_eventos WHERE id = ? AND estado = 'error' LIMIT 1`,
      [eventoId]
    );
    return ev;
  },

  /** Eventos en error con menos de 3 intentos y empresa conocida (los reintenta el worker). */
  async listarReintentables() {
    const [eventos] = await pool.query(
      `SELECT id, empresa_id, plan, meses, payload FROM wompi_eventos
        WHERE estado = 'error' AND intentos < 3 AND empresa_id IS NOT NULL`
    );
    return eventos;
  },

  /** Nombre, NIT y correo (el de la empresa o el de su admin) para el comprobante. */
  async datosFactura(empresaId) {
    const [[emp]] = await pool.query(
      `SELECT e.nombre, e.nit, COALESCE(e.email_empresa, u.email) AS email
         FROM empresas e
         LEFT JOIN usuarios u ON u.empresa_id = e.id AND u.rol = 'admin_empresa' AND u.activo = 1
        WHERE e.id = ? ORDER BY u.id LIMIT 1`,
      [empresaId]
    );
    return emp;
  },

  async idsAdminsEmpresa(empresaId) {
    const [admins] = await pool.query(
      `SELECT id FROM usuarios WHERE empresa_id = ? AND rol = 'admin_empresa' AND activo = 1`,
      [empresaId]
    );
    return admins.map((a) => a.id);
  },

  async nombreEmpresa(empresaId) {
    const [[empresa]] = await pool.query('SELECT nombre FROM empresas WHERE id = ?', [empresaId]);
    return empresa?.nombre;
  },

  /** Trabajadores activos y plan actual de la empresa (insumos para cobrar). */
  async uso(empresaId) {
    const [[fila]] = await pool.query(
      `SELECT (SELECT COUNT(*) FROM trabajadores WHERE empresa_id = e.id AND activo = 1) AS activos,
              e.plan AS plan_actual
         FROM empresas e WHERE e.id = ?`,
      [empresaId]
    );
    return fila;
  },
};

module.exports = WompiModel;
