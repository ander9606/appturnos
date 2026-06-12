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
  nomina: { trabajadores: number; costo: number; detalle: CostoNominaDetalle[] };
  costo_total: number;
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

  costos(params: ReporteParams): Promise<CostosResponse> {
    const qs = new URLSearchParams({ desde: params.desde, hasta: params.hasta });
    return api.get<CostosResponse>(`/api/reportes/costos?${qs}`);
  },

  historialTrabajador(trabajadorId: number, params: ReporteParams): Promise<HistorialTrabajadorResponse> {
    const qs = new URLSearchParams({ desde: params.desde, hasta: params.hasta });
    return api.get<HistorialTrabajadorResponse>(`/api/reportes/trabajador/${trabajadorId}?${qs}`);
  },
};
