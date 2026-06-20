import { api } from './client';
import type { PuntoMarcaje } from './puntos-marcaje';

// ── Types ─────────────────────────────────────────────────────────────────

export type EstadoPeriodo = 'abierto' | 'cerrado' | 'liquidado';
export type TipoPeriodo   = 'semanal' | 'quincenal' | 'mensual';

export interface PeriodoNomina {
  id: number;
  empresa_id: number;
  fecha_inicio: string;  // YYYY-MM-DD
  fecha_fin: string;     // YYYY-MM-DD
  tipo: TipoPeriodo;
  estado: EstadoPeriodo;
  cerrado_por: number | null;
  cerrado_at: string | null;
  created_at: string;
}

export interface RegistroDiario {
  id: number;
  empresa_id: number;
  trabajador_id: number;
  periodo_id: number;
  fecha: string;           // YYYY-MM-DD
  hora_entrada: string | null; // HH:MM:SS
  hora_salida: string | null;
  horas_ordinarias: number;
  horas_extra_diurnas: number;
  horas_extra_nocturnas: number;
  horas_nocturnas: number;
  horas_festivo: number;
  es_festivo: 0 | 1;
  novedad: string | null;
  tipo_dia: TipoDia;
  aprobado_por: number | null;
  valor_hora_snapshot: number | null; // frozen at period close (migration 010b); null for open periods
  created_at: string;
  // Joined
  trabajador_nombre: string;
  trabajador_apellido: string;
  advertencia?: string | null; // set by marcarSalida when weekly extra limit is near/exceeded
}

export type EstadoCompensatorio = 'pendiente' | 'asignado' | 'tomado';

export interface DescansoCompensatorio {
  id: number;
  empresa_id: number;
  trabajador_id: number;
  periodo_id: number;
  origen_fecha: string;       // YYYY-MM-DD — el domingo/festivo trabajado
  origen_registro_id: number | null;
  estado: EstadoCompensatorio;
  fecha_asignada: string | null; // YYYY-MM-DD — asignada por el empleador
  asignado_por: number | null;
  asignado_en: string | null;
  created_at: string;
  // Joined
  trabajador_nombre: string;
  trabajador_apellido: string;
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

export interface LiquidacionResumen {
  periodo: PeriodoNomina;
  lineas: LiquidacionLinea[];
  totales: { trabajadores: number; total_general: number };
}

export interface ResumenHoras {
  ordinarias: number;
  extraDiurnas: number;
  extraNocturnas: number;
  nocturnas: number;
  festivo: number;
  totalHoras: number;
  diasRegistrados: number;
}

export type TipoMarcacion = 'libre' | 'fijo';
export type TipoDia = 'ordinario' | 'descanso' | 'compensatorio' | 'incapacidad' | 'vacacion' | 'licencia';

export interface TrabajadorNominaPerfil {
  id: number;
  nombre: string;
  apellido: string;
  cargo: string | null;
  empresa_nombre: string | null;
  cargos: Array<{ id: number; nombre: string; codigo: string | null }>;
  tipo_marcacion: TipoMarcacion;
  punto_marcaje: PuntoMarcaje | null;
  salario_base: number | null;
  acepta_extras: boolean;
}

// ── API ───────────────────────────────────────────────────────────────────

export const nominaApi = {
  // ── Períodos ──────────────────────────────────────────────────────────

  listarPeriodos(params?: { estado?: EstadoPeriodo; page?: number; limit?: number }) {
    const qs = new URLSearchParams();
    if (params?.estado) qs.set('estado', params.estado);
    if (params?.page)   qs.set('page',   String(params.page));
    if (params?.limit)  qs.set('limit',  String(params.limit));
    const q = qs.toString() ? `?${qs}` : '';
    return api.get<{ data: PeriodoNomina[]; pagination: { page: number; limit: number; total: number } }>(
      `/api/nomina/periodos${q}`,
    );
  },

  crearPeriodo(datos: { fecha_inicio: string; fecha_fin: string; tipo?: TipoPeriodo }): Promise<PeriodoNomina> {
    return api.post<PeriodoNomina>('/api/nomina/periodos', datos);
  },

  cerrarPeriodo(periodoId: number): Promise<PeriodoNomina> {
    return api.post<PeriodoNomina>(`/api/nomina/periodos/${periodoId}/cerrar`);
  },

  liquidarPeriodo(periodoId: number): Promise<PeriodoNomina> {
    return api.post<PeriodoNomina>(`/api/nomina/periodos/${periodoId}/liquidar`);
  },

  // ── Registros diarios ─────────────────────────────────────────────────

  /** trabajador_nomina → solo sus registros; jefe/admin → todos */
  listarRegistros(params: {
    periodo_id?: number;
    trabajador_id?: number;
    fecha?: string;
    fecha_desde?: string;
    fecha_hasta?: string;
    page?: number;
    limit?: number;
  }) {
    const qs = new URLSearchParams();
    if (params.periodo_id)    qs.set('periodo_id',    String(params.periodo_id));
    if (params.trabajador_id) qs.set('trabajador_id', String(params.trabajador_id));
    if (params.fecha)         qs.set('fecha',         params.fecha);
    if (params.fecha_desde)   qs.set('fecha_desde',   params.fecha_desde);
    if (params.fecha_hasta)   qs.set('fecha_hasta',   params.fecha_hasta);
    if (params.page)          qs.set('page',          String(params.page));
    if (params.limit)         qs.set('limit',         String(params.limit));
    const q = qs.toString() ? `?${qs}` : '';
    return api.get<{ data: RegistroDiario[]; pagination: { page: number; limit: number; total: number } }>(
      `/api/nomina/registros${q}`,
    );
  },

  crearRegistro(datos: {
    periodo_id: number;
    fecha: string;
    hora_entrada: string;
    hora_salida?: string;
    trabajador_id?: number;
    novedad?: string;
  }): Promise<RegistroDiario> {
    return api.post<RegistroDiario>('/api/nomina/registros', datos);
  },

  corregirRegistro(id: number, datos: {
    tipo_dia?: TipoDia;
    novedad?: string;
    hora_entrada?: string;
    hora_salida?: string;
  }): Promise<RegistroDiario> {
    return api.put<RegistroDiario>(`/api/nomina/registros/${id}`, datos);
  },

  // ── Marcaje en tiempo real (trabajador_nomina) ────────────────────────────

  obtenerMiPerfil(): Promise<TrabajadorNominaPerfil> {
    return api.get<TrabajadorNominaPerfil>('/api/nomina/me');
  },

  marcarEntrada(datos?: { latitud?: number; longitud?: number }): Promise<RegistroDiario> {
    return api.post<RegistroDiario>('/api/nomina/registros/marcar-entrada', datos ?? {});
  },

  marcarSalida(registroId: number, datos?: { latitud?: number; longitud?: number }): Promise<RegistroDiario> {
    return api.post<RegistroDiario>(`/api/nomina/registros/${registroId}/marcar-salida`, datos ?? {});
  },

  // ── Compensatorios ────────────────────────────────────────────────────

  /** Trabajador → solo los suyos; gestor → todos (filtrable por estado). */
  listarCompensatorios(params?: { estado?: EstadoCompensatorio }): Promise<DescansoCompensatorio[]> {
    const qs = params?.estado ? `?estado=${params.estado}` : '';
    return api.get<DescansoCompensatorio[]>(`/api/nomina/compensatorios${qs}`);
  },

  /** Solo jefe_nomina / admin_empresa. */
  asignarCompensatorio(id: number, fechaAsignada: string): Promise<DescansoCompensatorio> {
    return api.put<DescansoCompensatorio>(
      `/api/nomina/compensatorios/${id}/asignar`,
      { fechaAsignada }
    );
  },

  // ── Liquidación ───────────────────────────────────────────────────────

  /** Solo admin_empresa / jefe_nomina */
  obtenerLiquidacion(periodoId: number): Promise<LiquidacionResumen> {
    return api.get<LiquidacionResumen>(`/api/nomina/liquidacion/${periodoId}`);
  },
};

// ── Client-side helpers ───────────────────────────────────────────────────

/** Aggregate horas from a list of registros (for the worker's own view). */
export function calcularResumenHoras(registros: RegistroDiario[]): ResumenHoras {
  const r = registros.reduce(
    (acc, reg) => ({
      ordinarias:    acc.ordinarias    + Number(reg.horas_ordinarias),
      extraDiurnas:  acc.extraDiurnas  + Number(reg.horas_extra_diurnas),
      extraNocturnas:acc.extraNocturnas + Number(reg.horas_extra_nocturnas),
      nocturnas:     acc.nocturnas     + Number(reg.horas_nocturnas),
      festivo:       acc.festivo       + Number(reg.horas_festivo),
    }),
    { ordinarias: 0, extraDiurnas: 0, extraNocturnas: 0, nocturnas: 0, festivo: 0 },
  );

  const totalHoras =
    r.ordinarias + r.extraDiurnas + r.extraNocturnas + r.nocturnas + r.festivo;

  return { ...r, totalHoras, diasRegistrados: registros.length };
}
