import { api } from './client';

export type TipoPunto = 'fijo' | 'zonal';
export type AlcancePunto = 'todos' | 'nomina';

export interface PuntoMarcaje {
  id: number;
  empresa_id: number;
  nombre: string;
  descripcion: string | null;
  latitud: number;
  longitud: number;
  radio_metros: number;
  tipo: TipoPunto;
  alcance: AlcancePunto;
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
  alcance?: AlcancePunto;
}

export type ActualizarPuntoMarcajePayload = Partial<CrearPuntoMarcajePayload> & { activo?: boolean };

/** Ubicación de la biblioteca disponible para prellenar un turno (alcance='todos'). */
export interface PuntoParaTurno {
  id: number;
  nombre: string;
  latitud: number;
  longitud: number;
  radio_metros: number;
}

export const puntosMarcajeApi = {
  listar(): Promise<PuntoMarcaje[]> {
    return api.get<PuntoMarcaje[]>('/api/puntos-marcaje');
  },

  paraTurnos(): Promise<PuntoParaTurno[]> {
    return api.get<PuntoParaTurno[]>('/api/puntos-marcaje/para-turnos');
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
