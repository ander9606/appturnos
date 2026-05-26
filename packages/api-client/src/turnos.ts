import { api } from './client';

// ── Types ─────────────────────────────────────────────────────────────────

export type EstadoAsignacion =
  | 'pendiente'
  | 'confirmado'
  | 'en_progreso'
  | 'completado'
  | 'no_presentado'
  | 'cancelado';

export type EstadoOferta = 'abierta' | 'en_proceso' | 'completada' | 'cancelada';

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
  tarifa_dia: number;
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
    fecha?: string;
    page?: number;
    limit?: number;
  }): Promise<PaginatedResponse<Oferta>> {
    const qs = new URLSearchParams();
    if (params?.estado) qs.set('estado', params.estado);
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
};
