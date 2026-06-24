import { api } from './client';

export interface PeriodoTurnoEventual {
  id: number;
  empresa_id: number;
  anio: number;
  trimestre: 1 | 2 | 3 | 4;
  fecha_inicio: string; // YYYY-MM-DD
  fecha_fin: string;
  estado: 'abierto' | 'liquidado';
  created_at: string;
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
  periodoActivo(): Promise<PeriodoTurnoEventual> {
    return api.get<PeriodoTurnoEventual>('/api/turnos/eventual/periodo-activo');
  },

  liquidacion(periodoId: number): Promise<LiquidacionEventualResponse> {
    return api.get<LiquidacionEventualResponse>(`/api/turnos/eventual/${periodoId}/liquidacion`);
  },

  liquidar(periodoId: number): Promise<PeriodoTurnoEventual> {
    return api.post<PeriodoTurnoEventual>(`/api/turnos/eventual/${periodoId}/liquidar`, {});
  },
};
