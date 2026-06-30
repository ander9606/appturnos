import { api } from './client';
import type { PaginatedResponse } from './turnos';

export type TipoAusencia = 'vacaciones' | 'permiso' | 'incapacidad' | 'otro';
export type EstadoAusencia = 'pendiente' | 'aprobada' | 'rechazada';

export interface Ausencia {
  id: number;
  empresa_id: number;
  trabajador_id: number;
  trabajador_nombre?: string;
  trabajador_apellido?: string;
  tipo: TipoAusencia;
  fecha_inicio: string;
  fecha_fin: string;
  motivo: string | null;
  estado: EstadoAusencia;
  aprobado_por: number | null;
  aprobado_at: string | null;
  created_at: string;
}

export interface CrearAusenciaPayload {
  tipo: TipoAusencia;
  fecha_inicio: string;
  fecha_fin: string;
  motivo?: string;
}

export const ausenciasApi = {
  listar(params: { estado?: EstadoAusencia; page?: number; limit?: number } = {}): Promise<{ data: Ausencia[]; pagination: PaginatedResponse<Ausencia>['pagination'] }> {
    const qs = new URLSearchParams();
    if (params.estado) qs.set('estado', params.estado);
    if (params.page)   qs.set('page', String(params.page));
    if (params.limit)  qs.set('limit', String(params.limit));
    const suffix = qs.toString() ? `?${qs}` : '';
    return api.get(`/api/ausencias${suffix}`);
  },

  crear(payload: CrearAusenciaPayload): Promise<Ausencia> {
    return api.post<Ausencia>('/api/ausencias', payload);
  },

  actualizarEstado(id: number, estado: 'aprobada' | 'rechazada'): Promise<Ausencia> {
    return api.patch<Ausencia>(`/api/ausencias/${id}/estado`, { estado });
  },

  contarPendientes(): Promise<{ total: number }> {
    return api.get<{ total: number }>('/api/ausencias/pendientes-count');
  },
};
