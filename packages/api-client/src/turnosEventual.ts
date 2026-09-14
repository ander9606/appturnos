import { api } from './client';

export type SegmentoTurnoEventual = 'nomina' | 'turnos';

export interface PeriodoTurnoEventual {
  id: number;
  empresa_id: number;
  segmento: SegmentoTurnoEventual;
  tipo: 'mensual' | 'quincenal' | 'semanal' | 'trimestral';
  fecha_inicio: string; // YYYY-MM-DD
  fecha_fin: string;
  estado: 'abierto' | 'liquidado';
  created_at: string;
}

export interface PeriodosEventualActivos {
  /** Trabajadores de nómina con turnos recurrentes ocasionales — ciclo trimestral. */
  nomina: PeriodoTurnoEventual;
  /** Personal de apoyo 100% turnos — sigue el ciclo de liquidación de la empresa. */
  turnos: PeriodoTurnoEventual;
}

export interface LineaLiquidacionEventual {
  trabajador_id: number;
  nombre_completo: string;
  turnos: number;
  horas: number;
  total: number;
}

export interface LiquidacionEventualResponse {
  periodo: PeriodoTurnoEventual;
  lineas: LineaLiquidacionEventual[];
  total_general: number;
}

export const turnosEventualApi = {
  periodoActivo(): Promise<PeriodosEventualActivos> {
    return api.get<PeriodosEventualActivos>('/api/turnos/eventual/periodo-activo');
  },

  liquidacion(periodoId: number): Promise<LiquidacionEventualResponse> {
    return api.get<LiquidacionEventualResponse>(`/api/turnos/eventual/${periodoId}/liquidacion`);
  },

  liquidar(periodoId: number): Promise<PeriodoTurnoEventual> {
    return api.post<PeriodoTurnoEventual>(`/api/turnos/eventual/${periodoId}/liquidar`, {});
  },
};
