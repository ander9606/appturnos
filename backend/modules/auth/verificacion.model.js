'use strict';

const { pool } = require('../../config/database');

// Tabla `codigos_verificacion` (OTP por correo/SMS). De plataforma: sin empresa_id.
// Cada sentencia es independiente (no hay transacción), así que no hace falta
// retener una conexión mientras el service envía el correo o el SMS.
const VerificacionModel = {
  /** Invalida los códigos sin usar de ese destino. */
  async invalidarCodigos(tipo, destino) {
    await pool.execute(
      `UPDATE codigos_verificacion SET usado = 1
       WHERE tipo = ? AND destino = ? AND usado = 0`,
      [tipo, destino],
    );
  },

  async crearCodigo(tipo, destino, codigo, expiresAt) {
    await pool.execute(
      `INSERT INTO codigos_verificacion (tipo, destino, codigo, expires_at)
       VALUES (?, ?, ?, ?)`,
      [tipo, destino, codigo, expiresAt],
    );
  },

  /** Código más reciente sin usar de ese destino (undefined si no hay). */
  async obtenerVigente(tipo, destino) {
    const [rows] = await pool.execute(
      `SELECT id, codigo, expires_at, intentos
       FROM codigos_verificacion
       WHERE tipo = ? AND destino = ? AND usado = 0
       ORDER BY created_at DESC LIMIT 1`,
      [tipo, destino],
    );
    return rows[0];
  },

  async marcarUsado(id) {
    await pool.execute(`UPDATE codigos_verificacion SET usado = 1 WHERE id = ?`, [id]);
  },

  async sumarIntento(id) {
    await pool.execute(
      `UPDATE codigos_verificacion SET intentos = intentos + 1 WHERE id = ?`,
      [id],
    );
  },
};

module.exports = VerificacionModel;
