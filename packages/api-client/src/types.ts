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
  email: string;
  rol: Rol;
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

// ── API wrapper ───────────────────────────────────────────────────────────

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message: string;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly code: string | undefined,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}
