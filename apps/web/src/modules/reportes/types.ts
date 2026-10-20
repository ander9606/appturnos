// Contrato de /api/reportes (espejo de packages/api-client/src/reportes.ts — la web no importa api-client).

export interface Rango { desde: string; hasta: string }

export type NivelInsight = 'alerta' | 'aviso' | 'info' | 'ok';
export interface Insight { id: string; nivel: NivelInsight; texto: string }

/** Costo de un lado (turnos o nómina) contra el período anterior de ese mismo lado. */
export interface CostoComparado {
  total: number;
  previo: number;
  /** null si el período anterior no tuvo costo (no hay base de comparación). */
  delta_pct: number | null;
}

/** Calificaciones (0 a 5) que los gestores dan a los turnos completados; solo las manuales. */
export interface CalificacionesTurnos {
  /** null si no hubo calificaciones en el período. */
  promedio: number | null;
  /** Promedio del período anterior; delta = promedio − previo (null si falta alguno). */
  previo: number | null;
  delta: number | null;
  calificadas: number;
  /** Turnos completados que todavía no tienen calificación. */
  sin_calificar: number;
  distribucion: { 1: number; 2: number; 3: number; 4: number; 5: number };
}

export interface PersonaCalificada { trabajador_id: number; nombre: string; apellido: string | null; n: number; promedio: number }

export interface ResumenTurnos {
  costo: CostoComparado;
  desglose: { tarifas: number; bonos: number };
  convocados: number;
  completados: number;
  no_presentados: number;
  cobertura: { plazas: number; cubiertas: number; pct: number | null };
  calificaciones: CalificacionesTurnos;
  insights: Insight[];
}

export interface ResumenNomina {
  costo: CostoComparado;
  desglose: { ordinario: number; nocturno: number; extras: number; festivo: number };
  insights: Insight[];
}

/** Turnos y nómina se analizan por separado y no se suman. */
export interface ResumenResponse {
  rango: Rango;
  previo: Rango;
  turnos: ResumenTurnos;
  /** null para quien no ve nómina (jefe de turnos). */
  nomina: ResumenNomina | null;
}

export interface ExtremoJornada { trabajador_id: number; nombre: string; apellido: string | null; fecha: string; horas: number }
export interface Jornadas { jornadas: number; promedio: number; mas_larga: ExtremoJornada | null; mas_corta: ExtremoJornada | null }

export interface HorasPersona {
  trabajador_id: number; nombre: string; apellido: string | null;
  horas: number; dias: number; prom_dia: number; prom_semana: number;
}

export interface PersonaCargo {
  trabajador_id: number; nombre: string; apellido: string | null; turnos: number; pago: number;
  /** null si no tuvo calificaciones en el período. */
  calificacion: { promedio: number; n: number } | null;
}
export interface CargoTurnos {
  cargo_id: number;
  cargo: string;
  /** Ordenadas por pago. turnos = 0: ya hizo este cargo (últimos 6 meses) pero no tuvo turnos. */
  personas: PersonaCargo[];
  total_turnos: number;
  total_pago: number;
  /** false con menos de 4 personas: no tiene sentido pedir rotación (jefes, encargados). */
  rotable: boolean;
}

export interface PersonasResponse {
  rango: Rango;
  turnos: {
    jornadas: Jornadas | null;
    cargos: CargoTurnos[];
    /** Solo con 3 o más calificaciones; "peores" son los de menor promedio entre el resto. */
    calificaciones: { mejores: PersonaCalificada[]; peores: PersonaCalificada[] };
    insights: Insight[];
  };
  nomina: {
    jornadas: Jornadas | null;
    horas: { prom_semana_equipo: number | null; ranking: HorasPersona[]; mas: HorasPersona[]; menos: HorasPersona[] };
    insights: Insight[];
  } | null;
}

export interface AsistenciaResponse {
  rango: Rango;
  turnos: { trabajador_id: number; nombre: string; apellido: string | null; total_turnos: number; completados: number; no_presentados: number }[];
  nomina: { trabajador_id: number; nombre: string; apellido: string | null; dias_registrados: number }[];
}

export interface CostosResponse {
  rango: Rango;
  /** null para quien no ve pagos individuales. */
  nomina: { trabajadores: number; costo: number; detalle: { trabajador_id: number; nombre: string; apellido: string | null; total: number }[] } | null;
}
