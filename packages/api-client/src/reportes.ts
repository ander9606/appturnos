import { api } from './client';

// ── Tipos ─────────────────────────────────────────────────────────────────

export interface ReporteRango {
  desde: string;
  hasta: string;
}

export interface AsistenciaTurno {
  trabajador_id: number;
  nombre: string;
  apellido: string | null;
  total_turnos: number;
  completados: number;
  no_presentados: number;
  en_progreso: number;
  confirmados: number;
}

export interface AsistenciaNomina {
  trabajador_id: number;
  nombre: string;
  apellido: string | null;
  dias_registrados: number;
}

export interface AsistenciaResponse {
  rango: ReporteRango;
  turnos: AsistenciaTurno[];
  nomina: AsistenciaNomina[];
}

export interface CostoNominaDetalle {
  trabajador_id: number;
  nombre: string;
  apellido: string | null;
  total: number;
}

export interface CostosResponse {
  rango: ReporteRango;
  turnos: { turnos_completados: number; costo: number };
  /** null para quien no ve pagos individuales (jefe_turnos). */
  nomina: { trabajadores: number; costo: number; detalle: CostoNominaDetalle[] } | null;
  costo_total: number;
}

export type NivelInsight = 'alerta' | 'aviso' | 'info' | 'ok';

export interface ResumenInsight {
  id: string;
  nivel: NivelInsight;
  texto: string;
}

export interface ResumenPeriodoResponse {
  rango: ReporteRango;
  /** Período anterior de igual duración, contra el que se compara. */
  previo: ReporteRango;
  costo: {
    total: number;
    previo: number;
    /** null si el período anterior no tuvo costo (no hay base de comparación). */
    delta_pct: number | null;
    turnos: number;
    /** null para quien no ve nómina (jefe_turnos). */
    nomina: number | null;
  };
  /** ordinario/nocturno/extras/festivo solo vienen para quien ve nómina. */
  desglose: {
    ordinario?: number;
    nocturno?: number;
    extras?: number;
    festivo?: number;
    turnos: number;
    bonos: number;
  };
  turnos: { convocados: number; completados: number; no_presentados: number };
  cobertura: { plazas: number; cubiertas: number; pct: number | null };
  insights: ResumenInsight[];
}

export interface HorasPersona {
  trabajador_id: number;
  nombre: string;
  apellido: string | null;
  horas: number;
  dias: number;
  prom_dia: number;
  prom_semana: number;
}

export interface PersonaCargo {
  trabajador_id: number;
  nombre: string;
  apellido: string | null;
  turnos: number;
  pago: number;
}

export interface CargoTurnos {
  cargo_id: number;
  cargo: string;
  /** Ordenadas por pago, de más a menos. turnos = 0 → ya hizo este cargo (últimos 6 meses) pero no tuvo turnos. */
  personas: PersonaCargo[];
  total_turnos: number;
  total_pago: number;
  /** false con menos de 4 personas: no tiene sentido pedir rotación (jefes, encargados). */
  rotable: boolean;
}

export interface ExtremoJornada {
  trabajador_id: number;
  nombre: string;
  apellido: string | null;
  fecha: string;
  horas: number;
}

export interface ResumenJornadas {
  jornadas: number;
  /** Horas promedio de una jornada (solo días/turnos con horas). */
  promedio: number;
  mas_larga: ExtremoJornada | null;
  mas_corta: ExtremoJornada | null;
}

export interface PersonasResponse {
  rango: ReporteRango;
  /** null para quien no ve nómina (jefe_turnos). */
  horas: {
    prom_semana_equipo: number | null;
    /** Solo quienes tienen 3 o más días con horas. */
    ranking: HorasPersona[];
    mas: HorasPersona[];
    menos: HorasPersona[];
  } | null;
  /** nomina: null para quien no ve nómina. Cada una es null si no hubo jornadas en el rango. */
  jornadas: { nomina: ResumenJornadas | null; turnos: ResumenJornadas | null };
  cargos: CargoTurnos[];
  insights: ResumenInsight[];
}

export interface TurnoHistorial {
  id: number;
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
  pago_total: number;
  estado: string;
}

export interface RegistroHistorial {
  id: number;
  fecha: string;
  hora_entrada: string | null;
  hora_salida: string | null;
  tipo_dia: string;
  novedad: string | null;
}

export interface HistorialTrabajadorResponse {
  trabajador: {
    id: number;
    nombre: string;
    apellido: string | null;
    cedula: string | null;
    tipo: string;
    cargo: string | null;
  };
  rango: ReporteRango;
  turnos: TurnoHistorial[];
  registros_nomina: RegistroHistorial[];
  resumen: { total_turnos: number; pago_turnos: number; dias_nomina: number };
}

export interface ReporteParams {
  desde: string;
  hasta: string;
}

// ── API ───────────────────────────────────────────────────────────────────

export const reportesApi = {
  asistencia(params: ReporteParams): Promise<AsistenciaResponse> {
    const qs = new URLSearchParams({ desde: params.desde, hasta: params.hasta });
    return api.get<AsistenciaResponse>(`/api/reportes/asistencia?${qs}`);
  },

  resumen(params: ReporteParams): Promise<ResumenPeriodoResponse> {
    const qs = new URLSearchParams({ desde: params.desde, hasta: params.hasta });
    return api.get<ResumenPeriodoResponse>(`/api/reportes/resumen?${qs}`);
  },

  personas(params: ReporteParams): Promise<PersonasResponse> {
    const qs = new URLSearchParams({ desde: params.desde, hasta: params.hasta });
    return api.get<PersonasResponse>(`/api/reportes/personas?${qs}`);
  },

  costos(params: ReporteParams): Promise<CostosResponse> {
    const qs = new URLSearchParams({ desde: params.desde, hasta: params.hasta });
    return api.get<CostosResponse>(`/api/reportes/costos?${qs}`);
  },

  historialTrabajador(trabajadorId: number, params: ReporteParams): Promise<HistorialTrabajadorResponse> {
    const qs = new URLSearchParams({ desde: params.desde, hasta: params.hasta });
    return api.get<HistorialTrabajadorResponse>(`/api/reportes/trabajador/${trabajadorId}?${qs}`);
  },
};
