export type EstadoOferta = 'borrador' | 'publicada' | 'en_progreso' | 'completada' | 'cancelada';
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
  asignados: number;
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
  calificacion: number | null;
  comentario: string | null;
  hora_ingreso: string | null;
  hora_egreso: string | null;
  trabajador?: { nombre: string; apellido: string; cedula?: string };
  puesto?: { cargo_nombre: string; tarifa_dia: number };
}
