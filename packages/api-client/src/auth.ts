import { api } from './client';
import {
  LoginResponse,
  ActivarCuentaResponse,
  UsuarioPerfil,
  TokenPair,
  UpdateProfileParams,
  ChangePasswordParams,
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
   * Actualiza nombre, apellido y/o email del usuario autenticado.
   */
  updateProfile(params: UpdateProfileParams): Promise<UsuarioPerfil> {
    return api.patch<UsuarioPerfil>('/api/auth/me', params);
  },

  /**
   * Cambia la contraseña del usuario autenticado.
   * Revoca todas las sesiones existentes al completarse.
   */
  changePassword(params: ChangePasswordParams): Promise<null> {
    return api.patch<null>('/api/auth/me/password', params);
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
  /**
   * Registro libre para trabajador_turnos (modelo marketplace).
   * No requiere cédula ni empresa preexistente.
   */
  registrar(params: {
    nombre: string;
    apellido?: string;
    email: string;
    password: string;
  }): Promise<LoginResponse> {
    return api.post<LoginResponse>(
      '/api/auth/registro',
      params,
      { authenticated: false },
    );
  },
};
