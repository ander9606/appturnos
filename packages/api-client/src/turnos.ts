import { api } from './client';

// ── Types ─────────────────────────────────────────────────────────────────

export type EstadoAsignacion =
  | 'pendiente'
  | 'confirmado'
  | 'en_progreso'
  | 'completado'
  | 'no_presentado'
  | 'cancelado';

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
  // Joined from ofertas_turno
  oferta_titulo: string;
  oferta_descripcion: string | null;
  oferta_fecha: string; // YYYY-MM-DD
  hora_inicio: string;  // HH:MM:SS
  hora_fin_estimada: string | null;
  lugar: string | null;
  latitud: number | null;
  longitud: number | null;
  // Joined from oferta_puestos
  tarifa_dia: number;
  puesto_id?: number;
  cargo_id?: number;
  cargo_codigo?: string;
  cargo_nombre?: string;
  tipo_geofence?: TipoGeofence;
  // Constructed by model (only on obtenerConDetalles)
  geofence_info?: GeofenceInfo;
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

export interface Oferta {
  id: number;
  empresa_id: number;
  titulo: string;
  descripcion: string | null;
  fecha: string; // YYYY-MM-DD
  hora_inicio: string;
  hora_fin_estimada: string | null;
  lugar: string | null;
  latitud: number | null;
  longitud: number | null;
  tarifa_dia: number;
  plazas_disponibles: number;
  plazas_cubiertas: number;
  estado: EstadoOferta;
  creado_por: number;
  created_at: string;
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
  }): Promise<PaginatedResponse<Oferta>> {
    const qs = new URLSearchParams();
    if (params?.estado) qs.set('estado', params.estado);
    if (params?.disponibles) qs.set('disponibles', '1');
    if (params?.fecha) qs.set('fecha', params.fecha);
    if (params?.page)  qs.set('page',  String(params.page));
    if (params?.limit) qs.set('limit', String(params.limit));
    const query = qs.toString() ? `?${qs}` : '';
    return api.get<PaginatedResponse<Oferta>>(`/api/turnos/ofertas${query}`);
  },

  /** Detalle de una oferta + sus asignaciones. */
  obtenerOferta(id: number): Promise<OfertaDetalle> {
    return api.get<OfertaDetalle>(`/api/turnos/ofertas/${id}`);
  },

  /** Postular al turno. */
  aplicar(ofertaId: number): Promise<Asignacion> {
    return api.post<Asignacion>(`/api/turnos/ofertas/${ofertaId}/aplicar`);
  },

  /** Retirar postulación (solo cuando estado === 'pendiente'). */
  retirar(ofertaId: number): Promise<null> {
    return api.delete<null>(`/api/turnos/ofertas/${ofertaId}/aplicar`);
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
    page?: number;
    limit?: number;
  }): Promise<PaginatedResponse<Asignacion>> {
    const qs = new URLSearchParams();
    if (params?.trabajador_id) qs.set('trabajador_id', String(params.trabajador_id));
    if (params?.oferta_id)     qs.set('oferta_id',     String(params.oferta_id));
    if (params?.fecha)          qs.set('fecha',          params.fecha);
    if (params?.page)           qs.set('page',           String(params.page));
    if (params?.limit)          qs.set('limit',          String(params.limit));
    const query = qs.toString() ? `?${qs}` : '';
    return api.get<PaginatedResponse<Asignacion>>(`/api/turnos/asignaciones${query}`);
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
