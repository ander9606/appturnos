'use strict';

const jwt = require('jsonwebtoken');
const crypto = require('crypto');

/**
 * Generación de tokens de autenticación.
 *  - Access token: JWT firmado, vida corta (15m por defecto).
 *  - Refresh token: cadena aleatoria opaca, se persiste en `refresh_tokens`
 *    y rota en cada uso (ver 06-AUTH.md).
 */

const ACCESS_EXPIRES = process.env.JWT_ACCESS_EXPIRES || '15m';
const REFRESH_DIAS = Number(process.env.JWT_REFRESH_DIAS) || 7;

class TokenService {
  /**
   * Firma un access token JWT.
   * @param {{id:number, empresa_id:number, rol:string, nombre:string}} usuario
   */
  static generarAccessToken(usuario) {
    return jwt.sign(
      {
        sub: usuario.id,
        empresa_id: usuario.empresa_id,
        rol: usuario.rol,
        nombre: usuario.nombre,
      },
      process.env.JWT_SECRET,
      { expiresIn: ACCESS_EXPIRES }
    );
  }

  /** Genera un refresh token opaco (128 caracteres hex). */
  static generarRefreshToken() {
    return crypto.randomBytes(64).toString('hex');
  }

  /** Fecha de expiración del refresh token (ahora + JWT_REFRESH_DIAS). */
  static fechaExpiracionRefresh() {
    const fecha = new Date();
    fecha.setDate(fecha.getDate() + REFRESH_DIAS);
    return fecha;
  }
}

module.exports = TokenService;
