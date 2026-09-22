'use strict';

const appleSigninAuth = require('apple-signin-auth');

/**
 * Proveedor OAuth de Apple (Sign in with Apple).
 *
 * Verifica un identityToken emitido por Apple (flujo nativo de
 * expo-apple-authentication) contra las claves públicas de Apple.
 *
 * A diferencia de Google, el identityToken de Apple nunca trae nombre —
 * Apple solo lo entrega una vez, fuera del token, y el registro libre ya
 * usa el prefijo del email como fallback (ver oauth.service.js). Ponytail:
 * no se hilvana el fullName del primer login — upgrade path: aceptar un
 * `nombre` opcional en POST /api/auth/oauth/apple si la UX importa más
 * que la simplicidad.
 *
 * Configuración necesaria:
 *   - APPLE_CLIENT_ID — bundle identifier de la app (com.zaturno.mobile).
 *     Para Sign in with Apple nativo el `aud` del token es el bundle id,
 *     no un Service ID (eso solo aplica al flujo web/REST).
 */

function audiencias() {
  const raw = process.env.APPLE_CLIENT_ID || '';
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

module.exports = {
  name: 'apple',

  /**
   * Verifica un identityToken de Apple y devuelve el perfil normalizado.
   * Lanza si el token es inválido, expirado o emitido para otro client_id.
   */
  async verifyToken(idToken) {
    const audience = audiencias();
    if (audience.length === 0) {
      throw new Error('APPLE_CLIENT_ID no configurado en el servidor');
    }

    const payload = await appleSigninAuth.verifyIdToken(idToken, {
      audience,
      ignoreExpiration: false,
    });

    return {
      provider_user_id: payload.sub,
      email: (payload.email || '').toLowerCase(),
      email_verified: payload.email_verified === true || payload.email_verified === 'true',
      nombre: '',
      apellido: null,
      avatar_url: null,
    };
  },
};
