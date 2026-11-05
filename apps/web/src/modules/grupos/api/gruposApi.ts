import { api } from '@/shared/api/axios';
import type { CrearGrupoPayload, EstadoGrupo, GrupoTurno, GrupoTurnoDetalle } from '../types';

export const gruposApi = {
  /** Por defecto solo los activos; los cerrados no reciben turnos nuevos. */
  listar: (estado: EstadoGrupo | 'todos' = 'activo') =>
    api.get<{ data: GrupoTurno[] }>(`/grupos-turno?estado=${estado}`).then(r => r.data),
  /** Resumen del grupo y sus turnos ordenados por fecha. */
  obtener: (id: number) => api.get<{ data: GrupoTurnoDetalle }>(`/grupos-turno/${id}`).then(r => r.data),
  /** 409 si tiene turnos sin terminar o con alguien trabajando: el mensaje del servidor dice cuál. */
  /** Con turnos terminados sin contrato firmado responde 409 (aviso): se repite con `confirmar` tras preguntar. */
  cerrar: (id: number, confirmar = false) =>
    api.post<{ data: GrupoTurno }>(`/grupos-turno/${id}/cerrar`, confirmar ? { confirmar: true } : undefined).then(r => r.data),
  reabrir: (id: number) => api.post<{ data: GrupoTurno }>(`/grupos-turno/${id}/reabrir`).then(r => r.data),
  /** Nombre repetido → 409 con `detalles[0].grupo_id`: el id del grupo que ya lo usa (para ofrecer "Usar ese"). */
  crear: (data: CrearGrupoPayload) => api.post<{ data: GrupoTurno }>('/grupos-turno', data).then(r => r.data),
};
