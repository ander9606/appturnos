import { api } from '@/shared/api/axios';
import type { Plan } from '../types';

export const adminApi = {
  getReportes: () =>
    api.get('/admin/reportes/global').then(r => r.data),

  listarEmpresas: (params?: { busqueda?: string; plan?: Plan; activo?: boolean; page?: number; limit?: number }) =>
    api.get('/admin/empresas', { params }).then(r => r.data),

  obtenerEmpresa: (id: number) =>
    api.get(`/admin/empresas/${id}`).then(r => r.data),

  crearEmpresa: (data: { nombre: string; slug: string; nit?: string; ciudad?: string; plan?: Plan; descripcion?: string }) =>
    api.post('/admin/empresas', data).then(r => r.data),

  actualizarEmpresa: (id: number, data: Record<string, unknown>) =>
    api.put(`/admin/empresas/${id}`, data).then(r => r.data),

  cambiarEstado: (id: number, activo: boolean) =>
    api.patch(`/admin/empresas/${id}/estado`, { activo }).then(r => r.data),
};
