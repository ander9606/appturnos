import { api } from './client';
import {
  LoginResponse,
  ActivarCuentaResponse,
  UsuarioPerfil,
  TokenPair,
} from './types';

export const authApi = {
  /**
   * Login con email + contraseña.
   * Devuelve el par de tokens + perfil del usuario.
   */
  login(email: string, password: string): Promise<LoginResponse> {
    return api.post<LoginResponse>(
      '/api/auth/login',
      { email, password },
      { authenticated: false },
    );
  },

  /**
   * Renueva el access token usando el refresh token.
   * El cliente HTTP lo hace automáticamente en 401s; este método
   * permite renovaciones manuales si se necesita.
   */
  refresh(refreshToken: string): Promise<TokenPair> {
    return api.post<TokenPair>(
      '/api/auth/refresh',
      { refresh_token: refreshToken },
      { authenticated: false },
    );
  },

  /**
   * Cierra la sesión revocando el refresh token en el servidor.
   */
  logout(refreshToken: string): Promise<null> {
    return api.post<null>(
      '/api/auth/logout',
      { refresh_token: refreshToken },
      { authenticated: false },
    );
  },

  /**
   * Devuelve el perfil del usuario autenticado.
   * Requiere access token válido.
   */
  me(): Promise<UsuarioPerfil> {
    return api.get<UsuarioPerfil>('/api/auth/me');
  },

  /**
   * Activa la cuenta de un trabajador que aún no tiene login.
   * El trabajador debe existir en la BD con la cédula indicada.
   *
   * @param cedula    Cédula / DNI del trabajador
   * @param email     Email que usará para iniciar sesión
   * @param password  Contraseña (mínimo 8 caracteres)
   */
  activarCuenta(params: {
    cedula: string;
    email: string;
    password: string;
  }): Promise<ActivarCuentaResponse> {
    return api.post<ActivarCuentaResponse>(
      '/api/auth/activar-cuenta',
      params,
      { authenticated: false },
    );
  },
};
