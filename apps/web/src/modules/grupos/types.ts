export type EstadoGrupo = 'activo' | 'cerrado';

/** Un grupo de turnos tal como lo devuelve GET /api/grupos-turno (solo lo que usa la web hasta ahora). */
export interface GrupoTurno {
  id: number;
  nombre: string;
  /** Lugar por defecto de los turnos nuevos del grupo (cada turno guarda su propia copia). */
  lugar: string | null;
  latitud: number | null;
  longitud: number | null;
  estado: EstadoGrupo;
  /** Turnos del grupo sin contar los cancelados. */
  total_turnos: number;
  /** Primer y último día de sus turnos (YYYY-MM-DD); null si aún no tiene turnos. Se calculan, no se guardan. */
  fecha_inicio: string | null;
  fecha_fin: string | null;
}

/** Lo que el formulario de turno guarda del grupo elegido (el lugar sirve para prellenar el del turno). */
export type GrupoElegido = Pick<GrupoTurno, 'id' | 'nombre' | 'lugar' | 'latitud' | 'longitud'>;

export interface CrearGrupoPayload {
  nombre: string;
  /** lugar, latitud y longitud van los tres o ninguno (422 si falta alguno). */
  lugar?: string;
  latitud?: number;
  longitud?: number;
}
