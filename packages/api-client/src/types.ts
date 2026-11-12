// ── Enums / literals ──────────────────────────────────────────────────────

export type Rol =
  | 'super_admin'
  | 'admin_empresa'
  | 'jefe_turnos'
  | 'jefe_nomina'
  | 'nomina'
  | 'trabajador_turnos'
  | 'trabajador_nomina';

export type TipoTrabajador = 'turnos' | 'nomina' | 'ambos';

// ── Auth ──────────────────────────────────────────────────────────────────

export interface UsuarioPerfil {
  id: number;
  empresa_id: number | null; // null para super_admin (cross-tenant)
  nombre: string;
  apellido: string;
  foto_perfil: string | null;
  email: string;
  telefono: string | null;
  rol: Rol;
  has_password: boolean; // false → usuario solo OAuth, debe completar perfil con teléfono
  terminos_aceptados_at: string | null;
}

export interface OAuthLoginResponse extends LoginResponse {
  tipo: 'login' | 'vinculacion' | 'registro';
}

export interface OAuthVinculo {
  id: number;
  provider: string;
  email: string | null;
  ultima_sesion: string | null;
  created_at: string;
}

export interface TokenPair {
  access_token: string;
  refresh_token: string;
}

export interface LoginResponse extends TokenPair {
  usuario: UsuarioPerfil;
}

export interface ActivarCuentaResponse {
  usuario_id: number;
  email: string;
  rol: Rol;
}

export interface UpdateProfileParams {
  nombre?: string;
  apellido?: string;
  email?: string;
  telefono?: string;
  telefono_token?: string;
}

export interface ChangePasswordParams {
  password_actual: string;
  password_nueva: string;
}

// ── API wrapper ───────────────────────────────────────────────────────────

/**
 * Detalle de un error del servidor (422 de validación: `{ campo, mensaje }`). Algunos errores
 * agregan datos propios: un grupo con nombre repetido (409) trae `grupo_id`, el del grupo que ya lo usa.
 */
export interface ApiErrorDetalle {
  campo?: string;
  mensaje?: string;
  grupo_id?: number | null;
  [clave: string]: unknown;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message: string;
  detalles?: ApiErrorDetalle[];
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly code: string | undefined,
    public readonly status: number,
    public readonly detalles?: ApiErrorDetalle[],
  ) {
    super(message);
    this.name = 'ApiError';
  }
}
