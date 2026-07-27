export type EstadoOferta = 'borrador' | 'abierta' | 'publicada' | 'en_proceso' | 'cerrada' | 'completada' | 'cancelada';
export type EstadoAsignacion =
  | 'pendiente'
  | 'confirmado'
  | 'en_progreso'
  | 'completado'
  | 'no_presentado'
  | 'cancelado';

export interface Puesto {
  id: number;
  oferta_id: number;
  cargo_id: number;
  cargo_nombre: string;
  plazas: number;
  tarifa_dia: number;
  notas: string | null;
  plazas_cubiertas: number;
}

export type VisibilidadOferta = 'abierta' | 'dirigida';

export interface OfertaDestinatario {
  trabajador_id: number;
  nombre: string;
  apellido: string;
}

export interface Oferta {
  id: number;
  titulo: string;
  fecha: string;
  hora_inicio: string;
  hora_fin_estimada: string | null;
  descripcion: string | null;
  lugar: string | null;
  latitud: number | null;
  longitud: number | null;
  encargado_nombre: string | null;
  encargado_telefono: string | null;
  estado: EstadoOferta;
  // 'dirigida': solo `destinatarios` la ven/reciben notificación, sin filtro de cargo ni ranking.
  visibilidad: VisibilidadOferta;
  destinatarios: OfertaDestinatario[];
  // Presentes solo si la oferta se originó desde logiq360 (evento orden.creada).
  external_ref: string | null;
  alquiler_ref: string | null;
  externo_notas: string | null;
  puestos: Puesto[];
  created_at: string;
}

export interface Asignacion {
  id: number;
  oferta_id: number;
  puesto_id: number;
  trabajador_id: number;
  estado: EstadoAsignacion;
  hora_ingreso_real: string | null;
  hora_egreso_real: string | null;
  trabajador_nombre: string;
  trabajador_apellido: string;
  cargo_nombre: string;
  // Solo viene poblado en el detalle puntual (obtenerAsignacion), no en el listado.
  calificacion?: number | null;
}
