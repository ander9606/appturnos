import { api } from './client';
import type { TipoTrabajador } from './types';

// ── Types ─────────────────────────────────────────────────────────────────

export type TipoDocumento = 'CC' | 'CE' | 'PAS';
export type SexoTrabajador = 'M' | 'F' | 'otro';
export type TipoCuenta = 'ahorros' | 'corriente';

export interface Trabajador {
  id: number;
  empresa_id: number;
  usuario_id: number | null;
  nombre: string;
  apellido: string;
  cedula: string | null;
  tipo_documento: TipoDocumento | null;
  fecha_nacimiento: string | null;
  sexo: SexoTrabajador | null;
  contacto_emergencia_nombre: string | null;
  contacto_emergencia_tel: string | null;
  telefono: string | null;
  email: string | null;
  tipo: TipoTrabajador;
  cargo: string | null;
  tarifa_hora: number | null;
  salario_base: number | null;
  eps: string | null;
  afp: string | null;
  banco: string | null;
  tipo_cuenta: TipoCuenta | null;
  numero_cuenta: string | null;
  ant_judiciales_fecha: string | null;
  ant_disciplinarios_fecha: string | null;
  activo: boolean;
  external_ref: string | null;
  ranking: number | null;
  total_calificaciones: number;
  created_at: string;
}

export interface TrabajadoresListParams {
  tipo?: TipoTrabajador;
  activo?: boolean;
  page?: number;
  limit?: number;
}

export interface TrabajadoresListResponse {
  data: Trabajador[];
  pagination: { page: number; limit: number; total: number };
}

export interface ExperienciaPayload {
  empresa_nombre: string;
  cargo: string;
  fecha_inicio: string;
  fecha_fin?: string | null;
}

export interface DiplomaPayload {
  titulo: string;
  institucion: string;
  anio?: number | null;
}

export interface CrearTrabajadorPayload {
  nombre: string;
  apellido: string;
  tipo?: TipoTrabajador;
  tipo_documento?: TipoDocumento;
  cedula?: string;
  fecha_nacimiento?: string;
  sexo?: SexoTrabajador;
  email?: string;
  telefono?: string;
  contacto_emergencia_nombre?: string;
  contacto_emergencia_tel?: string;
  eps?: string;
  afp?: string;
  banco?: string;
  tipo_cuenta?: TipoCuenta;
  numero_cuenta?: string;
  cargo?: string;
  tarifa_hora?: number;
  salario_base?: number;
  ant_judiciales_fecha?: string;
  ant_disciplinarios_fecha?: string;
  experiencias?: ExperienciaPayload[];
  diplomas?: DiplomaPayload[];
  cargo_ids?: number[];
  empresa_ids?: number[];
  external_ref?: string;
}

export interface ActualizarTrabajadorPayload extends Partial<CrearTrabajadorPayload> {}

// ── API ───────────────────────────────────────────────────────────────────

export const trabajadoresApi = {
  async listar(params: TrabajadoresListParams = {}): Promise<TrabajadoresListResponse> {
    const qs = new URLSearchParams();
    if (params.tipo !== undefined) qs.set('tipo', params.tipo);
    if (params.activo !== undefined) qs.set('activo', String(params.activo));
    if (params.page !== undefined) qs.set('page', String(params.page));
    if (params.limit !== undefined) qs.set('limit', String(params.limit));
    const suffix = qs.toString() ? `?${qs}` : '';
    return api.get<TrabajadoresListResponse>(`/api/trabajadores${suffix}`);
  },

  obtener: (id: number): Promise<Trabajador> =>
    api.get<Trabajador>(`/api/trabajadores/${id}`),

  crear: (payload: CrearTrabajadorPayload): Promise<Trabajador> =>
    api.post<Trabajador>('/api/trabajadores', payload),

  actualizar: (id: number, payload: ActualizarTrabajadorPayload): Promise<Trabajador> =>
    api.put<Trabajador>(`/api/trabajadores/${id}`, payload),

  desactivar: (id: number): Promise<void> =>
    api.delete<void>(`/api/trabajadores/${id}`),
};
