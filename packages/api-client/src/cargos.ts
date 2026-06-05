import { api } from './client';
import type { TipoGeofence } from './turnos';

export interface Cargo {
  id: number;
  empresa_id: number | null;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  tipo_geofence: TipoGeofence;
  activo: boolean;
}

export const cargosApi = {
  listar(): Promise<Cargo[]> {
    return api.get<Cargo[]>('/api/cargos');
  },
};
