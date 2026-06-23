import { api } from '@/shared/api/axios';
import type { EstadoOferta, EstadoAsignacion } from '../types';

export const turnosApi = {
  // Ofertas
  listarOfertas: (params?: { estado?: EstadoOferta; fecha?: string; page?: number; limit?: number }) =>
    api.get('/turnos/ofertas', { params }).then(r => r.data),

  obtenerOferta: (id: number) =>
    api.get(`/turnos/ofertas/${id}`).then(r => r.data),

  crearOferta: (data: Record<string, unknown>) =>
    api.post('/turnos/ofertas', data).then(r => r.data),

  actualizarOferta: (id: number, data: Record<string, unknown>) =>
    api.put(`/turnos/ofertas/${id}`, data).then(r => r.data),

  cancelarOferta: (id: number) =>
    api.delete(`/turnos/ofertas/${id}`).then(r => r.data),

  // Puestos
  listarPuestos: (ofertaId: number) =>
    api.get(`/turnos/ofertas/${ofertaId}/puestos`).then(r => r.data),

  // Asignaciones
  listarAsignaciones: (params?: { oferta_id?: number; trabajador_id?: number; estado?: EstadoAsignacion; fecha?: string; page?: number; limit?: number }) =>
    api.get('/turnos/asignaciones', { params }).then(r => r.data),

  confirmarAsignacion: (id: number) =>
    api.post(`/turnos/asignaciones/${id}/confirmar`).then(r => r.data),

  rechazarAsignacion: (id: number) =>
    api.post(`/turnos/asignaciones/${id}/rechazar`).then(r => r.data),

  cancelarAsignacion: (id: number) =>
    api.post(`/turnos/asignaciones/${id}/cancelar`).then(r => r.data),

  noPresentado: (id: number) =>
    api.post(`/turnos/asignaciones/${id}/no-presentado`).then(r => r.data),

  calificar: (id: number, data: { calificacion: number; comentario?: string }) =>
    api.post(`/turnos/asignaciones/${id}/calificar`, data).then(r => r.data),

  // Liquidación
  liquidacion: (params?: { fecha_inicio?: string; fecha_fin?: string }) =>
    api.get('/turnos/asignaciones/liquidacion', { params }).then(r => r.data),
};
