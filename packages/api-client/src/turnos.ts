import { api } from './client';
import type { TipoLiquidacion } from './empresas';

// ── Types ─────────────────────────────────────────────────────────────────

export type EstadoAsignacion =
  | 'pendiente'
  | 'confirmado'
  | 'en_progreso'
  | 'completado'
  | 'no_presentado'
  | 'cancelado';

// Fuente de verdad para validación en runtime. El backend (JS) debe
// mantenerse en sync con este array; ver backend/config/constants.js.
export const ESTADOS_ASIGNACION = [
  'pendiente',
  'confirmado',
  'en_progreso',
  'completado',
  'no_presentado',
  'cancelado',
] as const satisfies EstadoAsignacion[];

export type EstadoOferta =
  | 'borrador'
  | 'abierta'
  | 'publicada'
  | 'en_proceso'
  | 'cerrada'
  | 'completada'
  | 'cancelada';

export type TipoGeofence = 'oferta' | 'fijo' | 'zonal' | 'libre';

export type GeofenceInfo =
  | { tipo: 'oferta'; nombre: string | null; latitud: number | null; longitud: number | null; radio_metros: number }
  | { tipo: 'fijo';   nombre: string;        latitud: number;        longitud: number;        radio_metros: number }
  | { tipo: 'zonal' }
  | { tipo: 'libre' };

export interface Asignacion {
  id: number;
  empresa_id: number;
  oferta_id: number;
  trabajador_id: number;
  estado: EstadoAsignacion;
  hora_ingreso_real: string | null;
  hora_egreso_real: string | null;
  horas_trabajadas: number | null;
  pago_total: number | null;
  latitud_ingreso: number | null;
  longitud_ingreso: number | null;
  firma_digital: string | null;
  created_at: string;
  /** Solo presente en listarPorUsuario (feed "Mis Turnos" multi-empresa del trabajador). */
  empresa_nombre?: string;
  /** Solo presente en obtenerConDetalles (detalle de una asignación). */
  empresa_tipo_liquidacion?: TipoLiquidacion;
  // Joined from ofertas_turno
  oferta_titulo: string;
  oferta_descripcion: string | null;
  oferta_externo_notas: string | null;
  oferta_fecha: string; // YYYY-MM-DD
  hora_inicio: string;  // HH:MM:SS
  hora_fin_estimada: string | null;
  lugar: string | null;
  latitud: number | null;
  longitud: number | null;
  encargado_nombre: string | null;
  encargado_telefono: string | null;
  // Joined from oferta_puestos
  tarifa_dia: number;
  puesto_id?: number;
  cargo_id?: number;
  cargo_codigo?: string;
  cargo_nombre?: string;
  tipo_geofence?: TipoGeofence;
  // Constructed by model (only on obtenerConDetalles)
  geofence_info?: GeofenceInfo;
  // Hour breakdown (computed on-the-fly for completado shifts — all optional)
  horas_ordinarias?: number;
  horas_extra_diurnas?: number;
  horas_extra_nocturnas?: number;
  horas_nocturnas?: number;
  horas_festivo?: number;
  es_festivo?: number;
  // Auditoría de acciones de gestores
  rechazado_por: number | null;
  rechazado_at: string | null;
  cancelado_por: number | null;
  cancelado_at: string | null;
  // Joined from calificaciones_turno (LEFT JOIN — null if not yet rated)
  calificacion: number | null;
  calificacion_comentario: string | null;
  // Joined from trabajadores (only in gestor detail view)
  trabajador_nombre?: string;
  trabajador_apellido?: string;
  trabajador_cargo?: string;
}

export interface CalificacionResponse {
  asignacion_id: number;
  trabajador_id: number;
  ranking: number;
  total_calificaciones: number;
}

export interface OfertaPuesto {
  id: number;
  cargo_id: number;
  cargo_codigo: string;
  cargo_nombre: string;
  plazas: number;
  plazas_cubiertas: number;
  tarifa_dia: number;
  notas: string | null;
}

export type ParaQuienOferta = 'turnos' | 'nomina' | 'ambos';

export interface Oferta {
  id: number;
  empresa_id: number;
  /** Solo presente en el feed agregado multi-empresa (listarOfertas para trabajador_turnos). */
  empresa_nombre?: string;
  titulo: string;
  descripcion: string | null;
  fecha: string; // YYYY-MM-DD
  hora_inicio: string;
  hora_fin_estimada: string | null;
  lugar: string | null;
  latitud: number | null;
  longitud: number | null;
  encargado_nombre: string | null;
  encargado_telefono: string | null;
  estado: EstadoOferta;
  para_quien: ParaQuienOferta;
  creado_por: number;
  created_at: string;
  puestos: OfertaPuesto[];
}

export interface CrearOfertaPayload {
  titulo: string;
  descripcion?: string;
  fecha: string;           // YYYY-MM-DD
  hora_inicio: string;     // HH:mm:ss
  hora_fin_estimada?: string;
  lugar?: string;
  latitud?: number;
  longitud?: number;
  encargado_nombre?: string;
  encargado_telefono?: string;
  para_quien?: ParaQuienOferta;
  puestos: Array<{
    cargo_id: number;
    plazas: number;
    tarifa_dia: number;
    notas?: string;
  }>;
}

export interface OfertaDetalle extends Oferta {
  asignaciones: AsignacionResumen[];
}

export interface AsignacionResumen {
  id: number;
  trabajador_id: number;
  trabajador_nombre: string;
  trabajador_apellido: string;
  estado: EstadoAsignacion;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: { page: number; limit: number; total: number };
}

export interface LiquidacionTurnoLinea {
  asignacion_id: number;
  oferta_titulo: string;
  oferta_fecha: string;
  hora_inicio: string;
  hora_fin_estimada: string | null;
  lugar: string | null;
  hora_ingreso_real: string | null;
  hora_egreso_real: string | null;
  horas_trabajadas: number;
  tarifa_dia: number;
  cargo_nombre: string;
  pago_extra: number;
  pago_total: number;
  calificacion: number | null;
}

export interface LiquidacionTurnosTrabajador {
  trabajador_id: number;
  nombre: string;
  apellido: string;
  cargo: string | null;
  ranking: number | null;
  total_calificaciones: number;
  total_turnos: number;
  total_horas: number;
  pago_base: number;
  pago_extra: number;
  pago_total: number;
  turnos: LiquidacionTurnoLinea[];
}

// ── API ───────────────────────────────────────────────────────────────────

export const turnosApi = {
  // ── Mis turnos (trabajador) ───────────────────────────────────────────

  /** Todos los turnos y postulaciones del trabajador autenticado. */
  misTurnos(): Promise<Asignacion[]> {
    return api.get<Asignacion[]>('/api/turnos/mis-turnos');
  },

  // ── Ofertas ───────────────────────────────────────────────────────────

  /** Lista de ofertas con filtros opcionales. */
  listarOfertas(params?: {
    estado?: EstadoOferta;
    disponibles?: boolean;
    fecha?: string;
    page?: number;
    limit?: number;
    para_quien?: ParaQuienOferta;
  }): Promise<PaginatedResponse<Oferta>> {
    const qs = new URLSearchParams();
    if (params?.estado) qs.set('estado', params.estado);
    if (params?.disponibles) qs.set('disponibles', '1');
    if (params?.fecha) qs.set('fecha', params.fecha);
    if (params?.page)  qs.set('page',  String(params.page));
    if (params?.limit) qs.set('limit', String(params.limit));
    if (params?.para_quien) qs.set('para_quien', params.para_quien);
    const query = qs.toString() ? `?${qs}` : '';
    return api.get<PaginatedResponse<Oferta>>(`/api/turnos/ofertas${query}`);
  },

  /** Detalle de una oferta + sus asignaciones. */
  obtenerOferta(id: number): Promise<OfertaDetalle> {
    return api.get<OfertaDetalle>(`/api/turnos/ofertas/${id}`);
  },

  /** Crea una oferta nueva con sus puestos en una sola transacción. */
  crearOferta(payload: CrearOfertaPayload): Promise<Oferta> {
    return api.post<Oferta>('/api/turnos/ofertas', payload);
  },

  /** Duplica una oferta a una nueva fecha (copia título, horario, lugar y puestos). */
  duplicarOferta(ofertaId: number, fecha: string): Promise<Oferta> {
    return api.post<Oferta>(`/api/turnos/ofertas/${ofertaId}/duplicar`, { fecha });
  },

  /** Postular al turno en un puesto concreto. */
  aplicar(ofertaId: number, puestoId: number): Promise<Asignacion> {
    return api.post<Asignacion>(`/api/turnos/ofertas/${ofertaId}/aplicar`, { puesto_id: puestoId });
  },

  /**
   * Asignación directa por gestor/admin: confirma al trabajador sin postulación previa.
   * Solo para jefe_turnos y admin_empresa.
   */
  asignarDirecto(ofertaId: number, puestoId: number, trabajadorId: number): Promise<Asignacion> {
    return api.post<Asignacion>(`/api/turnos/ofertas/${ofertaId}/asignar`, {
      puesto_id: puestoId,
      trabajador_id: trabajadorId,
    });
  },

  /** Retirar postulación de un puesto (solo cuando estado === 'pendiente'). */
  retirar(ofertaId: number, puestoId: number): Promise<null> {
    return api.delete<null>(`/api/turnos/ofertas/${ofertaId}/aplicar`, { puesto_id: puestoId });
  },

  // ── Asignaciones ──────────────────────────────────────────────────────

  /**
   * Marca ingreso con GPS.
   * @param latitud  Latitud actual del dispositivo
   * @param longitud Longitud actual del dispositivo
   */
  marcarIngreso(asignacionId: number, latitud: number, longitud: number): Promise<Asignacion> {
    return api.post<Asignacion>(`/api/turnos/asignaciones/${asignacionId}/ingreso`, {
      latitud,
      longitud,
    });
  },

  /**
   * Marca egreso con firma digital (base64 PNG).
   */
  marcarEgreso(asignacionId: number, firmaB64: string): Promise<Asignacion> {
    return api.post<Asignacion>(`/api/turnos/asignaciones/${asignacionId}/egreso`, {
      firma_b64: firmaB64,
    });
  },

  /**
   * Detalle completo de una asignación (gestores/admin).
   * Incluye datos de oferta, trabajador y calificación.
   */
  obtenerAsignacion(id: number): Promise<Asignacion> {
    return api.get<Asignacion>(`/api/turnos/asignaciones/${id}`);
  },

  /**
   * Listar asignaciones con filtros (gestores/admin).
   */
  listarAsignaciones(params?: {
    trabajador_id?: number;
    oferta_id?: number;
    fecha?: string;
    estado?: EstadoAsignacion;
    page?: number;
    limit?: number;
  }): Promise<PaginatedResponse<Asignacion>> {
    const qs = new URLSearchParams();
    if (params?.trabajador_id) qs.set('trabajador_id', String(params.trabajador_id));
    if (params?.oferta_id)     qs.set('oferta_id',     String(params.oferta_id));
    if (params?.fecha)          qs.set('fecha',          params.fecha);
    if (params?.estado)         qs.set('estado',         params.estado);
    if (params?.page)           qs.set('page',           String(params.page));
    if (params?.limit)          qs.set('limit',          String(params.limit));
    const query = qs.toString() ? `?${qs}` : '';
    return api.get<PaginatedResponse<Asignacion>>(`/api/turnos/asignaciones${query}`);
  },

  /**
   * Confirma una postulación pendiente (pendiente → confirmado). Solo gestores/admin.
   */
  confirmar(asignacionId: number): Promise<Asignacion> {
    return api.post<Asignacion>(`/api/turnos/asignaciones/${asignacionId}/confirmar`, {});
  },

  /**
   * Rechaza una postulación pendiente (pendiente → cancelado). Solo gestores/admin.
   */
  rechazar(asignacionId: number): Promise<Asignacion> {
    return api.post<Asignacion>(`/api/turnos/asignaciones/${asignacionId}/rechazar`, {});
  },

  /**
   * Cancela una asignación confirmada (confirmado → cancelado). Devuelve la plaza. Solo gestores/admin.
   */
  cancelar(asignacionId: number): Promise<Asignacion> {
    return api.post<Asignacion>(`/api/turnos/asignaciones/${asignacionId}/cancelar`, {});
  },

  /**
   * Corrección manual de ingreso y/o egreso por gestor/admin (sin GPS ni firma).
   * Recalcula horas_trabajadas si se proporcionan ambos extremos.
   * Acepta ISO 8601: "2025-06-20T08:30:00" o "2025-06-20T08:30:00.000Z".
   */
  corregirAsignacion(
    asignacionId: number,
    datos: { hora_ingreso_real?: string; hora_egreso_real?: string }
  ): Promise<Asignacion> {
    return api.patch<Asignacion>(`/api/turnos/asignaciones/${asignacionId}/corregir`, datos);
  },

  /**
   * Liquidación de turnos: por trabajador, cuánto se le debe pagar.
   * Agrupa asignaciones completadas en el rango de fechas dado.
   */
  liquidacion(params?: { fecha_inicio?: string; fecha_fin?: string }): Promise<LiquidacionTurnosTrabajador[]> {
    const qs = new URLSearchParams();
    if (params?.fecha_inicio) qs.set('fecha_inicio', params.fecha_inicio);
    if (params?.fecha_fin)    qs.set('fecha_fin',    params.fecha_fin);
    const query = qs.toString() ? `?${qs}` : '';
    return api.get<LiquidacionTurnosTrabajador[]>(`/api/turnos/asignaciones/liquidacion${query}`);
  },

  /**
   * Marca al trabajador como no presentado. Automáticamente registra 0 estrellas
   * y recalcula su ranking. Solo gestores/admin.
   */
  marcarNoPresentado(asignacionId: number): Promise<Asignacion> {
    return api.post<Asignacion>(`/api/turnos/asignaciones/${asignacionId}/no-presentado`, {});
  },

  /**
   * Califica una asignación completada (1–5 ⭐). Solo gestores/admin.
   * Una asignación solo puede calificarse una vez.
   */
  calificar(
    asignacionId: number,
    calificacion: number,
    comentario?: string,
  ): Promise<CalificacionResponse> {
    return api.post<CalificacionResponse>(
      `/api/turnos/asignaciones/${asignacionId}/calificar`,
      { calificacion, comentario: comentario || undefined },
    );
  },
};
