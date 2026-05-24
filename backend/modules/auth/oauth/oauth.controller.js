'use strict';

const OAuthService = require('./oauth.service');

/**
 * POST /api/auth/oauth/:provider
 * Body: { token: <id_token o credential del provider> }
 *
 * Respuesta:
 *   { access_token, refresh_token, usuario, tipo }
 *   tipo ∈ 'login' | 'vinculacion' | 'registro'
 */
async function loginConProvider(req, res) {
  const providerName = req.params.provider;
  const { token } = req.body;
  const data = await OAuthService.loginConProvider(providerName, token);
  res.json({
    success: true,
    data,
    message:
      data.tipo === 'registro'
        ? 'Cuenta creada. ¡Bienvenido!'
        : data.tipo === 'vinculacion'
          ? `Vinculaste tu cuenta de ${providerName}`
          : 'Inicio de sesión exitoso',
  });
}

/** GET /api/auth/oauth/vinculos — lista de providers vinculados a mi cuenta. */
async function vinculos(req, res) {
  const data = await OAuthService.vinculosUsuario(req.usuario.sub);
  res.json({ success: true, data, message: 'Vínculos OAuth' });
}

/** DELETE /api/auth/oauth/:provider — desvincular un provider. */
async function desvincular(req, res) {
  const data = await OAuthService.desvincular(req.usuario.sub, req.params.provider);
  res.json({ success: true, data, message: 'Proveedor desvinculado' });
}

module.exports = { loginConProvider, vinculos, desvincular };
