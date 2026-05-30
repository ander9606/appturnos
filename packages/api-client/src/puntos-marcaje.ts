import { api } from './client';

export type TipoPunto = 'fijo' | 'zonal';

export interface PuntoMarcaje {
  id: number;
  empresa_id: number;
  nombre: string;
  descripcion: string | null;
  latitud: number;
  longitud: number;
  radio_metros: number;
  tipo: TipoPunto;
  activo: number;
  created_at: string;
}

export interface CrearPuntoMarcajePayload {
  nombre: string;
  descripcion?: string;
  latitud: number;
  longitud: number;
  radio_metros?: number;
  tipo?: TipoPunto;
}

export type ActualizarPuntoMarcajePayload = Partial<CrearPuntoMarcajePayload>;

export const puntosMarcajeApi = {
  listar(): Promise<PuntoMarcaje[]> {
    return api.get<PuntoMarcaje[]>('/api/puntos-marcaje');
  },

  crear(payload: CrearPuntoMarcajePayload): Promise<PuntoMarcaje> {
    return api.post<PuntoMarcaje>('/api/puntos-marcaje', payload);
  },

  actualizar(id: number, payload: ActualizarPuntoMarcajePayload): Promise<PuntoMarcaje> {
    return api.patch<PuntoMarcaje>(`/api/puntos-marcaje/${id}`, payload);
  },

  eliminar(id: number): Promise<null> {
    return api.delete<null>(`/api/puntos-marcaje/${id}`);
  },
};
