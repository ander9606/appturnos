import { api } from './client';
import {
  LoginResponse,
  ActivarCuentaResponse,
  UsuarioPerfil,
  TokenPair,
  UpdateProfileParams,
  ChangePasswordParams,
} from './types';

export interface CrearGestorPayload {
  nombre: string;
  apellido?: string;
  email: string;
  rol: 'jefe_turnos' | 'jefe_nomina' | 'nomina';
}

export interface CrearGestorResult {
  id: number;
  nombre: string;
  apellido: string | null;
  email: string;
  rol: string;
  password_temporal: string;
}

export interface Gestor {
  id: number;
  nombre: string;
  apellido: string | null;
  email: string;
  rol: 'jefe_turnos' | 'jefe_nomina' | 'nomina';
  activo: boolean;
  created_at: string;
}

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

  /** Registro público de empresa nueva + admin_empresa. */
  registrarEmpresa(params: {
    nombre_empresa: string;
    nit?: string;
    descripcion?: string;
    actividad?: string;
    telefono?: string;
    email_empresa?: string;
    direccion?: string;
    ciudad?: string;
    nombre: string;
    apellido?: string;
    email: string;
    password: string;
  }): Promise<LoginResponse> {
    return api.post<LoginResponse>(
      '/api/auth/registro-empresa',
      params,
      { authenticated: false },
    );
  },

  /** Actualiza (o elimina) la foto de perfil del usuario autenticado. */
  actualizarFoto(fotoB64: string | null): Promise<UsuarioPerfil> {
    return api.patch<UsuarioPerfil>('/api/auth/me/foto', { foto_b64: fotoB64 });
  },

  /** admin_empresa crea un usuario gestor en su empresa con contraseña temporal. */
  crearGestor(payload: CrearGestorPayload): Promise<CrearGestorResult> {
    return api.post<CrearGestorResult>('/api/auth/crear-gestor', payload);
  },

  /** Lista todos los gestores (jefe_turnos, jefe_nomina, nomina) de la empresa. */
  listarGestores(): Promise<Gestor[]> {
    return api.get<Gestor[]>('/api/auth/gestores');
  },

  /** Activa o desactiva un gestor de la empresa. */
  setActivoGestor(id: number, activo: boolean): Promise<null> {
    return api.patch<null>(`/api/auth/gestores/${id}/activo`, { activo });
  },
};
