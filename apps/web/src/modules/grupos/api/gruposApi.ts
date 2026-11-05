import { api } from '@/shared/api/axios';
import type { CrearGrupoPayload, EstadoGrupo, GrupoTurno } from '../types';

export const gruposApi = {
  /** Por defecto solo los activos; los cerrados no reciben turnos nuevos. */
  listar: (estado: EstadoGrupo | 'todos' = 'activo') =>
    api.get<{ data: GrupoTurno[] }>(`/grupos-turno?estado=${estado}`).then(r => r.data),
  obtener: (id: number) => api.get<{ data: GrupoTurno }>(`/grupos-turno/${id}`).then(r => r.data),
  /** Nombre repetido → 409 con `detalles[0].grupo_id`: el id del grupo que ya lo usa (para ofrecer "Usar ese"). */
  crear: (data: CrearGrupoPayload) => api.post<{ data: GrupoTurno }>('/grupos-turno', data).then(r => r.data),
};
