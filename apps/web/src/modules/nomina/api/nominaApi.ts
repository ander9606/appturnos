import { api } from '@/shared/api/axios';
import type { EstadoPeriodo, TipoPeriodo, TipoDia } from '../types';

export const nominaApi = {
  listarPeriodos: (params?: { estado?: EstadoPeriodo; page?: number; limit?: number }) =>
    api.get('/nomina/periodos', { params }).then(r => r.data),

  crearPeriodo: (data: { fecha_inicio: string; fecha_fin: string; tipo?: TipoPeriodo }) =>
    api.post('/nomina/periodos', data).then(r => r.data),

  cerrarPeriodo: (id: number) =>
    api.post(`/nomina/periodos/${id}/cerrar`).then(r => r.data),

  liquidarPeriodo: (id: number) =>
    api.post(`/nomina/periodos/${id}/liquidar`).then(r => r.data),

  listarRegistros: (params: { periodo_id?: number; trabajador_id?: number; fecha?: string; page?: number; limit?: number }) =>
    api.get('/nomina/registros', { params }).then(r => r.data),

  crearRegistro: (data: { periodo_id: number; fecha: string; hora_entrada: string; hora_salida?: string; trabajador_id: number; novedad?: string }) =>
    api.post('/nomina/registros', data).then(r => r.data),

  corregirRegistro: (id: number, data: { hora_entrada?: string; hora_salida?: string; novedad?: string; tipo_dia?: TipoDia }) =>
    api.put(`/nomina/registros/${id}`, data).then(r => r.data),

  obtenerLiquidacion: (periodoId: number) =>
    api.get(`/nomina/liquidacion/${periodoId}`).then(r => r.data),

  exportarLiquidacion: (periodoId: number) =>
    api.get(`/nomina/liquidacion/${periodoId}/export`, { responseType: 'blob' }),

  listarTrabajadores: () =>
    api.get('/trabajadores', { params: { tipo: 'nomina', activo: true, limit: 200 } }).then(r => r.data),
};
