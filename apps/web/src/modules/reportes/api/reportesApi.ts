import { api } from '@/shared/api/axios';
import type { AsistenciaResponse, CostosResponse, PersonasResponse, Rango, ResumenResponse } from '../types';

// El backend envuelve todo en { success, data, message }
const get = <T>(ruta: string, { desde, hasta }: Rango) =>
  api.get(`/reportes/${ruta}`, { params: { desde, hasta } }).then((r) => r.data.data as T);

export const reportesApi = {
  resumen: (r: Rango) => get<ResumenResponse>('resumen', r),
  personas: (r: Rango) => get<PersonasResponse>('personas', r),
  asistencia: (r: Rango) => get<AsistenciaResponse>('asistencia', r),
  costos: (r: Rango) => get<CostosResponse>('costos', r),
};
