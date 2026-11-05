export type EstadoGrupo = 'activo' | 'cerrado';

/** Momento del grupo, calculado por el servidor con las fechas de sus turnos; 'cerrado' si lo cerraron a mano. */
export type FaseGrupo = 'sin_turnos' | 'proximo' | 'en_curso' | 'terminado' | 'cerrado';

/** Un grupo de turnos tal como lo devuelve GET /api/grupos-turno (solo lo que usa la web hasta ahora). */
export interface GrupoTurno {
  id: number;
  nombre: string;
  descripcion?: string | null;
  /** Lugar por defecto de los turnos nuevos del grupo (cada turno guarda su propia copia). */
  lugar: string | null;
  /** Nombre corto del lugar por defecto; se copia a los turnos nuevos junto con el lugar. */
  lugar_alias?: string | null;
  latitud: number | null;
  longitud: number | null;
  estado: EstadoGrupo;
  /** Turnos del grupo sin contar los cancelados. */
  total_turnos: number;
  /** Primer y último día de sus turnos (YYYY-MM-DD); null si aún no tiene turnos. Se calculan, no se guardan. */
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
  fin_dia_siguiente: number | null;
  lugar: string | null;
  estado: string;
  plazas: number;
  plazas_cubiertas: number;
}

export interface GrupoTurnoDetalle extends GrupoTurno {
  turnos: TurnoDeGrupo[];
}

/** Lo que el formulario de turno guarda del grupo elegido (el lugar sirve para prellenar el del turno). */
export type GrupoElegido = Pick<GrupoTurno, 'id' | 'nombre' | 'lugar' | 'lugar_alias' | 'latitud' | 'longitud'>;

export interface CrearGrupoPayload {
  nombre: string;
  /** lugar, latitud y longitud van los tres o ninguno (422 si falta alguno). */
  lugar?: string;
  lugar_alias?: string;
  latitud?: number;
  longitud?: number;
}
