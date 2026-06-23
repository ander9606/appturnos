import { api } from '@/shared/api/axios';
import type { TipoTrabajador } from '../types';

export const equipoApi = {
  listar: (params?: { tipo?: TipoTrabajador; activo?: boolean; page?: number; limit?: number }) =>
    api.get('/trabajadores', { params }).then(r => r.data),

  obtener: (id: number) =>
    api.get(`/trabajadores/${id}`).then(r => r.data),

  crear: (data: Record<string, unknown>) =>
    api.post('/trabajadores', data).then(r => r.data),

  actualizar: (id: number, data: Record<string, unknown>) =>
    api.put(`/trabajadores/${id}`, data).then(r => r.data),

  desactivar: (id: number) =>
    api.delete(`/trabajadores/${id}`).then(r => r.data),
};
