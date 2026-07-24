import { api } from './client';

export type TipoNovedad = 'retraso' | 'ausencia' | 'incidente' | 'otro';

export interface Novedad {
  id: number;
  empresa_id: number;
  asignacion_id: number;
  autor_id: number;
  autor_nombre: string;
  autor_apellido: string;
  tipo: TipoNovedad;
  descripcion: string;
  hora_evento: string | null;
  foto_b64: string | null;
  latitud: number | null;
  longitud: number | null;
  created_at: string;
}

export interface CrearNovedadPayload {
  tipo: TipoNovedad;
  descripcion: string;
  hora_evento?: string | null;
  foto_b64?: string | null;
  latitud?: number | null;
  longitud?: number | null;
}

export const novedadesApi = {
  listar(asignacionId: number): Promise<Novedad[]> {
    return api.get<Novedad[]>(`/api/novedades/asignaciones/${asignacionId}`);
  },

  crear(asignacionId: number, payload: CrearNovedadPayload): Promise<Novedad> {
    return api.post<Novedad>(`/api/novedades/asignaciones/${asignacionId}`, payload);
  },
};
