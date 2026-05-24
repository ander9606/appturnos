'use strict';

const { OAuth2Client } = require('google-auth-library');

/**
 * Proveedor OAuth de Google.
 *
 * Verifica un ID token de Google (no un access token) contra las claves
 * públicas de Google y devuelve el perfil normalizado.
 *
 * Configuración necesaria:
 *   - GOOGLE_CLIENT_ID — uno o varios client_id separados por coma.
 *     Útil cuando hay clientes diferentes para iOS, Android y web.
 *
 * En frontend, usar:
 *   - Mobile: `expo-auth-session/providers/google` → idToken
 *   - Web:    `@react-oauth/google` → credential (es el id_token)
 */

const client = new OAuth2Client();

function audiencias() {
  const raw = process.env.GOOGLE_CLIENT_ID || '';
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

module.exports = {
  name: 'google',

  /**
   * Verifica un id_token de Google y devuelve el perfil normalizado.
   * Lanza si el token es inválido, expirado o emitido para otro client_id.
   */
  async verifyToken(idToken) {
    const audience = audiencias();
    if (audience.length === 0) {
      throw new Error('GOOGLE_CLIENT_ID no configurado en el servidor');
    }

    const ticket = await client.verifyIdToken({ idToken, audience });
    const payload = ticket.getPayload();
    if (!payload) {
      throw new Error('id_token de Google sin payload');
    }

    return {
      provider_user_id: payload.sub,
      email: (payload.email || '').toLowerCase(),
      email_verified: Boolean(payload.email_verified),
      nombre: payload.given_name || payload.name || '',
      apellido: payload.family_name || null,
      avatar_url: payload.picture || null,
    };
  },
};
