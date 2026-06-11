import { api } from './client';
import type { TipoGeofence } from './turnos';

export interface Cargo {
  id: number;
  empresa_id: number | null;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  tipo_geofence: TipoGeofence;
  punto_marcaje_id: number | null;
  activo: boolean;
}

export interface CrearCargoPayload {
  nombre: string;
  codigo?: string;
  descripcion?: string;
  tipo_geofence?: TipoGeofence;
  punto_marcaje_id?: number | null;
}

export interface ActualizarCargoPayload {
  nombre?: string;
  descripcion?: string | null;
  activo?: boolean;
  tipo_geofence?: TipoGeofence;
  punto_marcaje_id?: number | null;
}

export interface EliminarCargoResult {
  eliminado: boolean;
  desactivado: boolean;
  usos: number;
}

export const cargosApi = {
  listar(): Promise<Cargo[]> {
    return api.get<Cargo[]>('/api/cargos');
  },

  crear(payload: CrearCargoPayload): Promise<Cargo> {
    return api.post<Cargo>('/api/cargos', payload);
  },

  actualizar(id: number, payload: ActualizarCargoPayload): Promise<Cargo> {
    return api.patch<Cargo>(`/api/cargos/${id}`, payload);
  },

  eliminar(id: number): Promise<EliminarCargoResult> {
    return api.delete<EliminarCargoResult>(`/api/cargos/${id}`);
  },
};
