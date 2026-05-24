'use strict';

/**
 * Registry de proveedores OAuth. Para agregar Apple/Facebook/etc en el
 * futuro, basta con crear `<name>.provider.js` y mapearlo acá.
 *
 * Cada provider expone:
 *   - name: string
 *   - verifyToken(token): Promise<{
 *       provider_user_id, email, email_verified, nombre, apellido, avatar_url
 *     }>
 */

const providers = {
  google: require('./google.provider'),
  // apple: require('./apple.provider'),
  // facebook: require('./facebook.provider'),
};

/** Devuelve el provider o null si no está soportado. */
function getProvider(name) {
  return providers[name] || null;
}

/** Lista los nombres de providers disponibles (útil para validación). */
function listProviders() {
  return Object.keys(providers);
}

module.exports = { getProvider, listProviders };
