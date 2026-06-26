'use strict';

const jwt    = require('jsonwebtoken');
const crypto = require('crypto');

const ACCESS_EXPIRES = process.env.JWT_ACCESS_EXPIRES || '15m';
const REFRESH_DIAS   = Number(process.env.JWT_REFRESH_DIAS) || 7;

function generarAccessToken(usuario) {
  return jwt.sign(
    { sub: usuario.id, empresa_id: usuario.empresa_id ?? null, rol: usuario.rol, nombre: usuario.nombre },
    process.env.JWT_SECRET,
    { expiresIn: ACCESS_EXPIRES }
  );
}

function generarRefreshToken() {
  return crypto.randomBytes(64).toString('hex');
}

function fechaExpiracionRefresh() {
  const fecha = new Date();
  fecha.setDate(fecha.getDate() + REFRESH_DIAS);
  return fecha;
}

module.exports = { generarAccessToken, generarRefreshToken, fechaExpiracionRefresh };
