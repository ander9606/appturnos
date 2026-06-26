export type EstadoPeriodo = 'abierto' | 'cerrado' | 'liquidado';
export type TipoPeriodo = 'semanal' | 'quincenal' | 'mensual';
export type TipoDia = 'ordinario' | 'descanso' | 'compensatorio' | 'incapacidad' | 'vacacion' | 'licencia';

export interface Periodo {
  id: number;
  fecha_inicio: string;
  fecha_fin: string;
  tipo: TipoPeriodo;
  estado: EstadoPeriodo;
  created_at: string;
}

export interface Registro {
  id: number;
  trabajador_id: number;
  periodo_id: number;
  fecha: string;
  hora_entrada: string | null;
  hora_salida: string | null;
  horas_ordinarias: number;
  horas_extra_diurnas: number;
  horas_extra_nocturnas: number;
  horas_nocturnas: number;
  horas_festivo: number;
  es_festivo: number;
  tipo_dia: TipoDia;
  novedad: string | null;
  trabajador?: { nombre: string; apellido: string; cedula?: string };
}

export interface LiquidacionLinea {
  trabajador_id: number;
  nombre: string;
  apellido: string;
  cedula: string;
  dias_registrados: number;
  horas_ordinarias: number;
  horas_extra_diurnas: number;
  horas_extra_nocturnas: number;
  horas_nocturnas: number;
  horas_festivo: number;
  valor_hora: number;
  pago_por_horas: number;
  salario_minimo_periodo: number;
  ajuste_minimo: number;
  total: number;
}

export interface LiquidacionData {
  periodo: Periodo;
  lineas: LiquidacionLinea[];
  totales: { trabajadores: number; total_general: number };
}

export interface Trabajador {
  id: number;
  nombre: string;
  apellido: string;
  cedula: string;
  cargo: string | null;
}
