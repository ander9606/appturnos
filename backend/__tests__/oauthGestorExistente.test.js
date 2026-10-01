'use strict';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

// Login con Google: si el email ya es de un usuario (p. ej. un gestor creado por
// el admin) se enlaza a esa cuenta y conserva su rol; NO se crea un trabajador.
jest.mock('../modules/auth/oauth/providers', () => ({
  getProvider: jest.fn(),
  listProviders: jest.fn(() => ['google']),
}));
jest.mock('../modules/auth/oauth/oauth.model');
jest.mock('../modules/auth/auth.model');

const { getProvider } = require('../modules/auth/oauth/providers');
const OAuthModel = require('../modules/auth/oauth/oauth.model');
const AuthModel = require('../modules/auth/auth.model');
const OAuthService = require('../modules/auth/oauth/oauth.service');

const info = { provider_user_id: 'g1', email: 'jefe@x.com', email_verified: true, nombre: 'Jefe' };

beforeEach(() => {
  jest.resetAllMocks();
  getProvider.mockReturnValue({ verifyToken: jest.fn().mockResolvedValue(info) });
  OAuthModel.buscarLinkPorProvider.mockResolvedValue(null);
  AuthModel.guardarRefreshToken.mockResolvedValue();
});

test('email de un gestor existente → vincula y entra como gestor, sin crear trabajador', async () => {
  AuthModel.buscarUsuarioPorEmail.mockResolvedValue({
    id: 5, empresa_id: 1, rol: 'jefe_turnos', activo: 1, nombre: 'Jefe', email: 'jefe@x.com',
  });

  const r = await OAuthService.loginConProvider('google', 'tok');

  expect(r.tipo).toBe('vinculacion');
  expect(r.usuario.rol).toBe('jefe_turnos');
  expect(AuthModel.registrarTrabajadorLibre).not.toHaveBeenCalled();
});
