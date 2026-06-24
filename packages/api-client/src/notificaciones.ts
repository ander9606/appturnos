import { api } from './client';
import type { PaginatedResponse } from './turnos';

export interface Notificacion {
  id:         number;
  tipo:       string;
  titulo:     string;
  mensaje:    string;
  data:       Record<string, unknown> | null;
  leida:      boolean;
  created_at: string;
}

export interface ListarNotificacionesResponse {
  data:       Notificacion[];
  no_leidas:  number;
  pagination: PaginatedResponse<Notificacion>['pagination'];
}

export const notificacionesApi = {
  registrarExpoToken(token: string): Promise<null> {
    return api.post<null>('/api/push/expo-token', { token });
  },

  desregistrarExpoToken(token: string): Promise<null> {
    return api.delete<null>('/api/push/expo-token', { token });
  },

  listar(params?: { page?: number; limit?: number; no_leidas?: boolean }): Promise<ListarNotificacionesResponse> {
    const q = new URLSearchParams();
    if (params?.page)      q.set('page',      String(params.page));
    if (params?.limit)     q.set('limit',     String(params.limit));
    if (params?.no_leidas) q.set('no_leidas', '1');
    const qs = q.toString();
    return api.get<ListarNotificacionesResponse>(`/api/notificaciones${qs ? `?${qs}` : ''}`);
  },

  marcarLeida(id: number): Promise<null> {
    return api.post<null>(`/api/notificaciones/${id}/leer`, {});
  },

  marcarTodasLeidas(): Promise<{ marcadas: number }> {
    return api.post<{ marcadas: number }>('/api/notificaciones/leer-todas', {});
  },
};
