import { apiRequest } from './client';
import type { TipoTrabajador } from './types';

// ── Types ─────────────────────────────────────────────────────────────────

export interface Trabajador {
  id: number;
  empresa_id: number;
  usuario_id: number | null;
  nombre: string;
  apellido: string;
  cedula: string | null;
  telefono: string | null;
  email: string | null;
  tipo: TipoTrabajador;
  cargo: string | null;
  tarifa_hora: number | null;
  salario_base: number | null;
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

export interface CrearTrabajadorPayload {
  nombre: string;
  apellido: string;
  tipo?: TipoTrabajador;
  cedula?: string;
  email?: string;
  telefono?: string;
  cargo?: string;
  tarifa_hora?: number;
  salario_base?: number;
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
    const res = await apiRequest<TrabajadoresListResponse>(`/api/trabajadores${suffix}`, {
      method: 'GET',
    });
    return res.data;
  },

  async obtener(id: number): Promise<Trabajador> {
    const res = await apiRequest<Trabajador>(`/api/trabajadores/${id}`, { method: 'GET' });
    return res.data;
  },

  async crear(payload: CrearTrabajadorPayload): Promise<Trabajador> {
    const res = await apiRequest<Trabajador>('/api/trabajadores', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return res.data;
  },

  async actualizar(id: number, payload: ActualizarTrabajadorPayload): Promise<Trabajador> {
    const res = await apiRequest<Trabajador>(`/api/trabajadores/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    return res.data;
  },

  async desactivar(id: number): Promise<void> {
    await apiRequest<void>(`/api/trabajadores/${id}`, { method: 'DELETE' });
  },
};
