'use strict';
const crypto   = require('crypto');
const jwt      = require('jsonwebtoken');
const AppError = require('../../utils/AppError');
const { enviarEmail } = require('../../utils/mailer');
const { plantillaCorreo, bloqueCodigo } = require('../../utils/plantillaCorreo');
const { enviarSms }   = require('../../utils/sms');
const logger = require('../../utils/logger');
const AuthModel = require('./auth.model');
const VerificacionModel = require('./verificacion.model');

const OTP_TTL_MIN  = 10;
const MAX_INTENTOS = 5;

function generarCodigo() {
  return String(crypto.randomInt(100000, 999999));
}

async function enviarOtp(tipo, destino) {
  // Invalidate any existing unused codes for this destination
  await VerificacionModel.invalidarCodigos(tipo, destino);

  const codigo    = generarCodigo();
  const expiresAt = new Date(Date.now() + OTP_TTL_MIN * 60 * 1000);

  await VerificacionModel.crearCodigo(tipo, destino, codigo, expiresAt);

  if (tipo === 'email') {
    // Hora en el asunto: evita que Gmail/Outlook agrupen varios códigos en
    // un mismo hilo y oculten el más reciente — cada envío se ve como
    // mensaje nuevo y distinguible.
    const horaEnvio = new Date().toLocaleTimeString('es-CO', {
      hour: '2-digit', minute: '2-digit', timeZone: 'America/Bogota',
    });
    await enviarEmail({
      to:      destino,
      subject: `Tu código de verificación (${horaEnvio}) — Zaturno`,
      html: plantillaCorreo({
        titulo: 'Tu código de verificación',
        cuerpo: `<p style="margin:0">Usa este código para continuar:</p>${bloqueCodigo(codigo)}`,
        nota: `Válido por ${OTP_TTL_MIN} minutos. No lo compartas con nadie.`,
      }),
    });
  } else {
    await enviarSms({
      to:   destino,
      body: `Tu código Zaturno: ${codigo}. Válido ${OTP_TTL_MIN} min.`,
    });
  }
}

/**
 * Código para recuperar contraseña: solo se envía si el email pertenece a una
 * cuenta activa. Quien lo llama responde siempre lo mismo exista o no, para no
 * revelar qué correos están registrados, y no espera el envío — así tampoco se
 * distingue por tiempo de respuesta.
 */
async function enviarOtpRecuperacion(email) {
  const usuario = await AuthModel.buscarUsuarioPorEmail(email);
  if (!usuario || !usuario.activo) return;
  enviarOtp('email', email).catch((err) =>
    logger.error(`[verificacion] no se pudo enviar OTP de recuperación: ${err.message}`));
}

async function verificarOtp(tipo, destino, codigo) {
  const row = await VerificacionModel.obtenerVigente(tipo, destino);

  if (!row) {
    throw new AppError('Ese código ya no es válido. Usa el del correo más reciente, o toca "Reenviar código".', 400);
  }

  if (row.intentos >= MAX_INTENTOS) {
    await VerificacionModel.marcarUsado(row.id);
    throw new AppError('Demasiados intentos fallidos. Solicita un nuevo código.', 429);
  }

  if (new Date() > new Date(row.expires_at)) {
    await VerificacionModel.marcarUsado(row.id);
    throw new AppError('El código ha expirado. Solicita uno nuevo.', 400);
  }

  if (row.codigo !== codigo) {
    await VerificacionModel.sumarIntento(row.id);
    throw new AppError('Código incorrecto.', 400);
  }

  await VerificacionModel.marcarUsado(row.id);

  // Short-lived token the registration endpoint will check
  const token = jwt.sign({ tipo, destino }, process.env.JWT_SECRET, { expiresIn: '15m' });
  return token;
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

module.exports = { enviarOtp, enviarOtpRecuperacion, verificarOtp, validarTokenVerificacion };
