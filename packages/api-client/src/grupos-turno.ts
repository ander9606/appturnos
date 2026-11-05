import { api } from './client';
import type { EstadoOferta } from './turnos';
import type { ApiErrorDetalle } from './types';

export type EstadoGrupo = 'activo' | 'cerrado';

/**
 * Fase del grupo, calculada con las fechas de sus turnos (hoy en Colombia): 'sin_turnos' si aún no
 * tiene ninguno, 'proximo', 'en_curso' o 'terminado'; 'cerrado' si lo cerraron a mano.
 */
export type FaseGrupo = 'sin_turnos' | 'proximo' | 'en_curso' | 'terminado' | 'cerrado';

export interface GrupoTurno {
  id: number;
  empresa_id: number;
  nombre: string;
  descripcion: string | null;
  /** Lugar por defecto de los turnos nuevos del grupo (cada turno guarda su propia copia). Va completo o no va. */
  lugar: string | null;
  latitud: number | null;
  longitud: number | null;
  estado: EstadoGrupo;
  cerrado_at: string | null;
  created_at: string;
  /** Turnos del grupo sin contar los cancelados. */
  total_turnos: number;
  /** Primer y último día de sus turnos (YYYY-MM-DD); null si no tiene turnos. Se calculan, no se guardan. */
  fecha_inicio: string | null;
  fecha_fin: string | null;
  fase: FaseGrupo;
}

/** Un turno dentro del detalle de un grupo (los cancelados también salen, con su estado). */
export interface TurnoDeGrupo {
  id: number;
  titulo: string;
  fecha: string; // YYYY-MM-DD
  hora_inicio: string;
  hora_fin_estimada: string | null;
  /** 1 si el turno termina al día siguiente (cruza la medianoche). */
  fin_dia_siguiente: number | null;
  lugar: string | null;
  estado: EstadoOferta;
  plazas: number;
  plazas_cubiertas: number;
}

export interface GrupoTurnoDetalle extends GrupoTurno {
  turnos: TurnoDeGrupo[];
}

export interface CrearGrupoPayload {
  nombre: string;
  descripcion?: string;
  /** lugar, latitud y longitud van los tres o ninguno (422 si falta alguno). */
  lugar?: string;
  latitud?: number;
  longitud?: number;
}

/** `null` borra el valor. Para quitar el lugar hay que mandar lugar, latitud y longitud en null. */
export interface ActualizarGrupoPayload {
  nombre?: string;
  descripcion?: string | null;
  lugar?: string | null;
  latitud?: number | null;
  longitud?: number | null;
}

export const gruposTurnoApi = {
  /** Por defecto solo los activos. Los cerrados se piden con `estado: 'cerrado'` (o todos con 'todos'). */
  listar(estado: EstadoGrupo | 'todos' = 'activo'): Promise<GrupoTurno[]> {
    return api.get<GrupoTurno[]>(`/api/grupos-turno?estado=${estado}`);
  },

  /** Resumen del grupo y sus turnos ordenados por fecha. */
  obtener(id: number): Promise<GrupoTurnoDetalle> {
    return api.get<GrupoTurnoDetalle>(`/api/grupos-turno/${id}`);
  },

  /**
   * Nombre repetido en la empresa → ApiError 409 cuyo `detalles[0].grupo_id` es el id del grupo que
   * ya lo usa (para ofrecer "Usar ese").
   */
  crear(payload: CrearGrupoPayload): Promise<GrupoTurno> {
    return api.post<GrupoTurno>('/api/grupos-turno', payload);
  },

  actualizar(id: number, payload: ActualizarGrupoPayload): Promise<GrupoTurno> {
    return api.patch<GrupoTurno>(`/api/grupos-turno/${id}`, payload);
  },

  /**
   * 409 si tiene turnos sin terminar o con alguien trabajando. Un grupo se cierra, no se borra. Si quedan turnos
   * terminados sin contrato firmado el 409 es un aviso (`esAvisoCierre(err)`): se repite con `confirmar: true`
   * después de preguntarle al usuario. Cerrar no cambia ningún pago.
   */
  cerrar(id: number, opciones?: { confirmar?: boolean }): Promise<GrupoTurno> {
    return api.post<GrupoTurno>(`/api/grupos-turno/${id}/cerrar`, opciones?.confirmar ? { confirmar: true } : undefined);
  },

  reabrir(id: number): Promise<GrupoTurno> {
    return api.post<GrupoTurno>(`/api/grupos-turno/${id}/reabrir`);
  },
};

/** ¿Este error es el aviso "hay contratos sin firmar" de cerrar un grupo (se puede cerrar confirmando)? */
export function esAvisoCierre(err: unknown): err is { message: string; detalles: ApiErrorDetalle[] } {
  const detalles = (err as { detalles?: ApiErrorDetalle[] } | null)?.detalles;
  return (err as { status?: number } | null)?.status === 409 && detalles?.[0]?.codigo === 'confirmar_cierre';
}
