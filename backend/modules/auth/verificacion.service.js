'use strict';
const crypto   = require('crypto');
const jwt      = require('jsonwebtoken');
const { pool } = require('../../config/database');
const AppError = require('../../utils/AppError');
const { enviarEmail } = require('../../utils/mailer');
const { enviarSms }   = require('../../utils/sms');
const logger = require('../../utils/logger');

const OTP_TTL_MIN  = 10;
const MAX_INTENTOS = 5;

function generarCodigo() {
  return String(crypto.randomInt(100000, 999999));
}

async function enviarOtp(tipo, destino) {
  const conn = await pool.getConnection();
  try {
    // Invalidate any existing unused codes for this destination
    await conn.execute(
      `UPDATE codigos_verificacion SET usado = 1
       WHERE tipo = ? AND destino = ? AND usado = 0`,
      [tipo, destino],
    );

    const codigo    = generarCodigo();
    const expiresAt = new Date(Date.now() + OTP_TTL_MIN * 60 * 1000);

    await conn.execute(
      `INSERT INTO codigos_verificacion (tipo, destino, codigo, expires_at)
       VALUES (?, ?, ?, ?)`,
      [tipo, destino, codigo, expiresAt],
    );

    if (tipo === 'email') {
      // Hora en el asunto: evita que Gmail/Outlook agrupen varios códigos en
      // un mismo hilo y oculten el más reciente — cada envío se ve como
      // mensaje nuevo y distinguible.
      const horaEnvio = new Date().toLocaleTimeString('es-CO', {
        hour: '2-digit', minute: '2-digit', timeZone: 'America/Bogota',
      });
      await enviarEmail({
        to:      destino,
        subject: `Tu código de verificación (${horaEnvio}) — Zaturnos`,
        html: `
          <p>Tu código de verificación es:</p>
          <h2 style="letter-spacing:6px;font-size:36px;">${codigo}</h2>
          <p>Válido por ${OTP_TTL_MIN} minutos. No lo compartas con nadie.</p>
        `,
      });
    } else {
      await enviarSms({
        to:   destino,
        body: `Tu código Zaturnos: ${codigo}. Válido ${OTP_TTL_MIN} min.`,
      });
    }
  } finally {
    conn.release();
  }
}

async function verificarOtp(tipo, destino, codigo) {
  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.execute(
      `SELECT id, codigo, expires_at, intentos
       FROM codigos_verificacion
       WHERE tipo = ? AND destino = ? AND usado = 0
       ORDER BY created_at DESC LIMIT 1`,
      [tipo, destino],
    );

    if (!rows.length) {
      throw new AppError('Ese código ya no es válido. Usa el del correo más reciente, o toca "Reenviar código".', 400);
    }

    const row = rows[0];

    if (row.intentos >= MAX_INTENTOS) {
      await conn.execute(`UPDATE codigos_verificacion SET usado = 1 WHERE id = ?`, [row.id]);
      throw new AppError('Demasiados intentos fallidos. Solicita un nuevo código.', 429);
    }

    if (new Date() > new Date(row.expires_at)) {
      await conn.execute(`UPDATE codigos_verificacion SET usado = 1 WHERE id = ?`, [row.id]);
      throw new AppError('El código ha expirado. Solicita uno nuevo.', 400);
    }

    if (row.codigo !== codigo) {
      await conn.execute(
        `UPDATE codigos_verificacion SET intentos = intentos + 1 WHERE id = ?`,
        [row.id],
      );
      throw new AppError('Código incorrecto.', 400);
    }

    await conn.execute(`UPDATE codigos_verificacion SET usado = 1 WHERE id = ?`, [row.id]);

    // Short-lived token the registration endpoint will check
    const token = jwt.sign({ tipo, destino }, process.env.JWT_SECRET, { expiresIn: '15m' });
    return token;
  } finally {
    conn.release();
  }
}

function validarTokenVerificacion(token, tipo, destino) {
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (payload.tipo !== tipo || payload.destino !== destino) {
      throw new AppError('El token de verificación no corresponde a este destino.', 400);
    }
  } catch (err) {
    if (err instanceof AppError) throw err;
    logger.warn(`[verificacion] jwt.verify falló (tipo: ${tipo}, destino: ${destino}): ${err.name} — ${err.message}`);
    throw new AppError('Token de verificación inválido o expirado.', 400);
  }
}

module.exports = { enviarOtp, verificarOtp, validarTokenVerificacion };
