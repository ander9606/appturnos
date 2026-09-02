import { api } from '@/shared/api/axios';
import type { EstadoOferta, EstadoAsignacion } from '../types';

export const turnosApi = {
  // Ofertas
  listarOfertas: (params?: { estado?: EstadoOferta; fecha?: string; fecha_desde?: string; fecha_hasta?: string; page?: number; limit?: number }) =>
    api.get('/turnos/ofertas', { params }).then(r => r.data),

  obtenerOferta: (id: number) =>
    api.get(`/turnos/ofertas/${id}`).then(r => r.data),

  crearOferta: (data: Record<string, unknown>) =>
    api.post('/turnos/ofertas', data).then(r => r.data),

  actualizarOferta: (id: number, data: Record<string, unknown>) =>
    api.put(`/turnos/ofertas/${id}`, data).then(r => r.data),

  publicarOferta: (id: number) =>
    api.post(`/turnos/ofertas/${id}/publicar`).then(r => r.data),

  completarOferta: (id: number) =>
    api.post(`/turnos/ofertas/${id}/completar`).then(r => r.data),

  cancelarOferta: (id: number) =>
    api.delete(`/turnos/ofertas/${id}`).then(r => r.data),

  // Puestos
  listarPuestos: (ofertaId: number) =>
    api.get(`/turnos/ofertas/${ofertaId}/puestos`).then(r => r.data),

  // Asignaciones
  listarAsignaciones: (params?: { oferta_id?: number; trabajador_id?: number; estado?: EstadoAsignacion; fecha?: string; sospechoso?: boolean; page?: number; limit?: number }) =>
    api.get('/turnos/asignaciones', {
      params: { ...params, sospechoso: params?.sospechoso === undefined ? undefined : (params.sospechoso ? '1' : '0') },
    }).then(r => r.data),

  confirmarAsignacion: (id: number) =>
    api.post(`/turnos/asignaciones/${id}/confirmar`).then(r => r.data),

  rechazarAsignacion: (id: number) =>
    api.post(`/turnos/asignaciones/${id}/rechazar`).then(r => r.data),

  cancelarAsignacion: (id: number) =>
    api.post(`/turnos/asignaciones/${id}/cancelar`).then(r => r.data),

  noPresentado: (id: number) =>
    api.post(`/turnos/asignaciones/${id}/no-presentado`).then(r => r.data),

  /**
   * Corrección manual de ingreso/egreso por gestor (sin GPS ni firma). Acepta
   * "YYYY-MM-DDTHH:MM:SS" (hora local, sin offset). Un campo omitido (no `null`)
   * deja ese valor sin cambios — el backend solo distingue "no vino en el body".
   */
  corregirAsignacion: (id: number, data: { hora_ingreso_real?: string; hora_egreso_real?: string }) =>
    api.patch(`/turnos/asignaciones/${id}/corregir`, data).then(r => r.data),

  calificar: (id: number, data: { calificacion: number; comentario?: string }) =>
    api.post(`/turnos/asignaciones/${id}/calificar`, data).then(r => r.data),

  descartarSospechoso: (id: number) =>
    api.put(`/turnos/asignaciones/${id}/sospechoso/descartar`).then(r => r.data),

  crearPuesto: (ofertaId: number, data: { cargo_id: number; plazas?: number; tarifa_dia: number; notas?: string }) =>
    api.post(`/turnos/ofertas/${ofertaId}/puestos`, data).then(r => r.data),

  actualizarPuesto: (ofertaId: number, puestoId: number, data: { plazas?: number; tarifa_dia?: number; notas?: string | null }) =>
    api.patch(`/turnos/ofertas/${ofertaId}/puestos/${puestoId}`, data).then(r => r.data),

  eliminarPuesto: (ofertaId: number, puestoId: number) =>
    api.delete(`/turnos/ofertas/${ofertaId}/puestos/${puestoId}`).then(r => r.data),

  // Liquidación
  liquidacion: (params?: { fecha_inicio?: string; fecha_fin?: string }) =>
    api.get('/turnos/asignaciones/liquidacion', { params }).then(r => r.data),

  /** Período activo de liquidación (segmentos nómina/turnos) — /turnos/eventual vive en otro módulo del backend. */
  periodoActivoEventual: () =>
    api.get('/turnos/eventual/periodo-activo').then(r => r.data),

  // Contrato del turno (generado al completarse la asignación)
  descargarContratoPorAsignacion: (asignacionId: number) =>
    api.get(`/contratos/asignacion/${asignacionId}/pdf`, { responseType: 'blob' }).then(r => r.data),
};
