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
  /** Solo presentes cuando se pide `conTotales: true` (mismo cálculo que la pestaña Liquidación). */
  total_estimado?: number;
  total_neto_estimado?: number;
  trabajadores?: number;
  /** false si el período sigue abierto — el monto puede seguir cambiando. */
  es_definitivo?: boolean;
}

export interface Registro {
  id: number;
  trabajador_id: number;
  periodo_id: number;
  fecha: string;
  hora_entrada: string | null;
  /** Primer ingreso del día — no cambia si hubo un reingreso (hora_entrada sí cambia). */
  hora_entrada_inicial: string | null;
  hora_salida: string | null;
  /** Ubicación donde se marcó — solo presente si el trabajador tiene tipo_marcacion fijo/zonal. */
  latitud_entrada: number | null;
  longitud_entrada: number | null;
  latitud_salida: number | null;
  longitud_salida: number | null;
  horas_ordinarias: number;
  horas_extra_diurnas: number;
  horas_extra_nocturnas: number;
  horas_nocturnas: number;
  horas_festivo: number;
  es_festivo: number;
  tipo_dia: TipoDia;
  novedad: string | null;
  trabajador_nombre: string;
  trabajador_apellido: string;
}

export interface LiquidacionLinea {
  trabajador_id: number;
  nombre: string;
  apellido: string;
  cedula: string;
  /** Datos bancarios del trabajador — para pagarle sin salir de la liquidación. */
  banco: string | null;
  tipo_cuenta: 'ahorros' | 'corriente' | null;
  numero_cuenta: string | null;
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
  /** Descuento de salud (4% del total). 0 si la empresa es prestación de servicios. */
  descuento_salud: number;
  /** Descuento de pensión (4% + fondo de solidaridad si aplica). 0 si prestación de servicios. */
  descuento_pension: number;
  /** Descuentos manuales ya aceptados por el trabajador (préstamos, inasistencias, etc.). */
  otros_descuentos: Array<{ id: number; tipo: TipoDescuento; motivo: string; monto: number }>;
  otros_descuentos_total: number;
  /** Auxilio de transporte proporcional al período. No es IBC — se suma después de las deducciones. 0 si prestación de servicios o si el salario supera el tope legal. */
  subsidio_transporte: number;
  /** total - descuento_salud - descuento_pension - otros_descuentos_total + subsidio_transporte. */
  neto: number;
}

export type TipoContrato = 'laboral' | 'prestacion_servicios';

export type TipoDescuento = 'prestamo' | 'inasistencia' | 'dano_equipo' | 'anticipo' | 'otro';
export type EstadoDescuento = 'pendiente' | 'aceptado' | 'rechazado';

export interface DescuentoNomina {
  id: number;
  trabajador_id: number;
  periodo_id: number;
  tipo: TipoDescuento;
  motivo: string;
  monto: number;
  estado: EstadoDescuento;
  creado_por: number;
  respondido_at: string | null;
  created_at: string;
  trabajador_nombre: string;
  trabajador_apellido: string;
}

export interface LiquidacionData {
  periodo: Periodo;
  /** Régimen de la empresa — determina si `lineas[].neto` trae descuentos aplicados. */
  tipo_contrato: TipoContrato;
  lineas: LiquidacionLinea[];
  totales: { trabajadores: number; total_general: number; total_neto_general: number };
}

export interface Trabajador {
  id: number;
  nombre: string;
  apellido: string;
  cedula: string;
  cargo: string | null;
}
