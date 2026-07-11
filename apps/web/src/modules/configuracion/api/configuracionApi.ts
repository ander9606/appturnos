import { api } from '@/shared/api/axios';
import type { Empresa, PuntoMarcaje, Cargo, Gestor, Suscripcion, LinkPago } from '../types';

export const configuracionApi = {
  // Empresa
  getEmpresa: () => api.get<{ data: Empresa }>('/empresas/me').then(r => r.data),
  updateEmpresa: (data: Partial<Empresa>) => api.patch<{ data: Empresa }>('/empresas/me', data).then(r => r.data),

  // Suscripción
  getSuscripcion: () => api.get<{ data: Suscripcion }>('/empresas/suscripcion').then(r => r.data),
  pagarSuscripcion: (meses?: number) =>
    api.post<{ data: LinkPago }>('/empresas/suscripcion/pagar', meses ? { meses } : {}).then(r => r.data),

  // Puntos de marcaje
  getPuntos: () => api.get<{ data: PuntoMarcaje[] }>('/puntos-marcaje').then(r => r.data),
  createPunto: (data: Omit<PuntoMarcaje, 'id' | 'activo'>) =>
    api.post<{ data: PuntoMarcaje }>('/puntos-marcaje', data).then(r => r.data),
  updatePunto: (id: number, data: Partial<PuntoMarcaje>) =>
    api.patch<{ data: PuntoMarcaje }>(`/puntos-marcaje/${id}`, data).then(r => r.data),
  deletePunto: (id: number) => api.delete(`/puntos-marcaje/${id}`).then(r => r.data),

  // Cargos
  getCargos: () => api.get<{ data: Cargo[] }>('/cargos').then(r => r.data),
  createCargo: (data: { nombre: string; descripcion?: string }) =>
    api.post<{ data: Cargo }>('/cargos', data).then(r => r.data),
  updateCargo: (id: number, data: { nombre?: string; descripcion?: string }) =>
    api.patch<{ data: Cargo }>(`/cargos/${id}`, data).then(r => r.data),
  deleteCargo: (id: number) => api.delete(`/cargos/${id}`).then(r => r.data),

  // Gestores
  getGestores: () => api.get<{ data: Gestor[] }>('/auth/gestores').then(r => r.data),
  createGestor: (data: { nombre: string; apellido: string; email: string; rol: string; password: string }) =>
    api.post<{ data: Gestor }>('/auth/crear-gestor', data).then(r => r.data),
  toggleGestorActivo: (id: number, activo: boolean) =>
    api.patch(`/auth/gestores/${id}/activo`, { activo }).then(r => r.data),
};
