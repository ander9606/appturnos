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
  /** Bono extra (ej. propina) que el gestor asignó a este turno — ya sumado dentro de `pago_total`. */
  bono_monto?: number;
  bono_motivo?: string | null;
  latitud_ingreso: number | null;
  longitud_ingreso: number | null;
  latitud_egreso: number | null;
  longitud_egreso: number | null;
  sospechoso: 0 | 1; // otro trabajador marcó ingreso desde el mismo dispositivo y ubicación — posible buddy punching, solo auditoría
  firma_digital: string | null;
  created_at: string;
  /** Solo presente en listarPorUsuario (feed "Mis Turnos" multi-empresa del trabajador). */
  empresa_nombre?: string;
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
  // Constructed by model — obtenerConDetalles, listarPorTrabajador, listarPorUsuario
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
  /** Si es `0`, el contrato del turno completado aún no lo firma el trabajador
   *  — su pago no cuenta en la liquidación hasta que exista la firma. Siempre
   *  viene `0` cuando trabajador_tipo es 'nomina' aunque no exista contrato
   *  (no aplica — su turno eventual se paga como bono, no como contrato). */
  contrato_firmado?: 0 | 1;
  /** tipo del trabajador dueño de la asignación ('nomina' = turno eventual
   *  pagado como bono, sin contrato civil independiente). */
  trabajador_tipo?: 'nomina' | 'turnos' | 'ambos';
  // Joined from trabajadores (only in gestor detail view)
  trabajador_nombre?: string;
  trabajador_apellido?: string;
  trabajador_cargo?: string;
  /** Avisos devueltos por el backend (ej: turno ya empezó). Presente solo cuando hay condiciones que avisar. */
  warnings?: string[];
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
  /** Solo presente justo después de crear/actualizar: aviso si `plazas` supera
   *  los trabajadores activos certificados para el cargo. No bloquea. */
  advertencia?: string | null;
}

export type ParaQuienOferta = 'turnos' | 'nomina' | 'ambos';
export type VisibilidadOferta = 'abierta' | 'dirigida';

export interface OfertaDestinatario {
  trabajador_id: number;
  usuario_id: number;
  nombre: string;
  apellido: string;
}

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
  /** Sin restricción de ubicación al marcar ingreso/egreso — gana sobre el tipo_geofence del cargo. */
  ubicacion_libre: 0 | 1;
  encargado_nombre: string | null;
  encargado_telefono: string | null;
  estado: EstadoOferta;
  para_quien: ParaQuienOferta;
  /** 'dirigida': solo `destinatarios` la ven/reciben notificación, sin filtro de cargo ni ranking. */
  visibilidad: VisibilidadOferta;
  /** Presente cuando visibilidad = 'dirigida'. */
  destinatarios: OfertaDestinatario[];
  creado_por: number;
  created_at: string;
  puestos: OfertaPuesto[];
  /** Solo presente justo después de crear: avisos de capacidad por puesto
   *  (plazas pedidas > trabajadores certificados activos). No bloquea. */
  advertencias?: string[];
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
  /** Sin restricción de ubicación al marcar ingreso/egreso (ej. rutas, entregas). Default: false. */
  ubicacion_libre?: boolean;
  encargado_nombre?: string;
  encargado_telefono?: string;
  para_quien?: ParaQuienOferta;
  /** 'dirigida' requiere trabajador_ids con al menos una persona. */
  visibilidad?: VisibilidadOferta;
  trabajador_ids?: number[];
  puestos: Array<{
    cargo_id: number;
    plazas: number;
    tarifa_dia: number;
    notas?: string;
  }>;
}

/**
 * Edición parcial de una oferta ya creada (PUT). Solo aplica mientras está en
 * 'abierta' o 'borrador' — el backend rechaza el resto de estados. Refleja
 * CAMPOS_EDITABLES en ofertas.model.js; puestos/destinatarios no son editables acá.
 */
export interface ActualizarOfertaPayload {
  titulo?: string;
  descripcion?: string;
  fecha?: string;
  hora_inicio?: string;
  hora_fin_estimada?: string;
  lugar?: string;
  latitud?: number;
  longitud?: number;
  ubicacion_libre?: boolean;
  encargado_nombre?: string;
  encargado_telefono?: string;
  para_quien?: ParaQuienOferta;
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
  puesto_id: number;
  cargo_codigo: string;
  cargo_nombre: string;
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
  /** Bono extra (ej. propina) de este turno — ya sumado dentro de `pago_total`. */
  bono_monto: number;
  bono_motivo: string | null;
  pago_total: number;
  calificacion: number | null;
  /** Si es `false`, el contrato del turno aún no lo firma el trabajador —
   *  su pago no está incluido en los totales de `LiquidacionTurnosTrabajador`. */
  firmado_trabajador: boolean;
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
  /** Suma de bonos extra (ej. propinas) de los turnos firmados — ya incluida en `pago_total`. */
  bono_monto: number;
  pago_total: number;
  /** Turnos completados sin firma del trabajador, excluidos de los totales de pago. */
  turnos_pendientes_firma: number;
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
    fecha_desde?: string;
    fecha_hasta?: string;
    page?: number;
    limit?: number;
    para_quien?: ParaQuienOferta;
  }): Promise<PaginatedResponse<Oferta>> {
    const qs = new URLSearchParams();
    if (params?.estado) qs.set('estado', params.estado);
    if (params?.disponibles) qs.set('disponibles', '1');
    if (params?.fecha) qs.set('fecha', params.fecha);
    if (params?.fecha_desde) qs.set('fecha_desde', params.fecha_desde);
    if (params?.fecha_hasta) qs.set('fecha_hasta', params.fecha_hasta);
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

  /**
   * Edita una oferta existente (parcial). Solo mientras esté 'abierta' o
   * 'borrador' — el backend rechaza el resto de estados con 409.
   */
  actualizarOferta(ofertaId: number, payload: ActualizarOfertaPayload): Promise<Oferta> {
    return api.put<Oferta>(`/api/turnos/ofertas/${ofertaId}`, payload);
  },

  /**
   * Duplica una oferta a una nueva fecha (copia título, lugar y puestos).
   * `hora_inicio` (HH:MM:SS) es opcional — si se omite, conserva el horario original;
   * si se envía, la hora de fin se recalcula para conservar la misma duración.
   */
  duplicarOferta(ofertaId: number, fecha: string, hora_inicio?: string): Promise<Oferta> {
    return api.post<Oferta>(`/api/turnos/ofertas/${ofertaId}/duplicar`, { fecha, hora_inicio });
  },

  /** Marca la oferta como completada a mano (el jefe/admin decide, sin depender de la fecha ni del estado de las asignaciones). */
  completarOferta(ofertaId: number): Promise<Oferta> {
    return api.post<Oferta>(`/api/turnos/ofertas/${ofertaId}/completar`, {});
  },

  /** Cancela una oferta completa (todos sus puestos) y notifica a los postulados/asignados. */
  cancelarOferta(ofertaId: number): Promise<null> {
    return api.delete<null>(`/api/turnos/ofertas/${ofertaId}`);
  },

  /** Borra definitivamente una oferta cancelada que nunca tuvo postulantes. */
  eliminarOfertaDefinitivo(ofertaId: number): Promise<null> {
    return api.delete<null>(`/api/turnos/ofertas/${ofertaId}/definitivo`);
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
   * Marca ingreso con GPS. lat/lng quedan `undefined` para cargos con
   * tipo_geofence='libre' sin fix de GPS disponible (ej. camioneros) — el
   * backend no exige ubicación en ese caso.
   * @param latitud  Latitud actual del dispositivo
   * @param longitud Longitud actual del dispositivo
   */
  marcarIngreso(asignacionId: number, latitud: number | undefined, longitud: number | undefined, deviceId?: string): Promise<Asignacion> {
    return api.post<Asignacion>(`/api/turnos/asignaciones/${asignacionId}/ingreso`, {
      latitud,
      longitud,
      device_id: deviceId,
    });
  },

  /** Descarta el flag de sospechoso de una asignación tras revisión del gestor. */
  descartarSospechoso(asignacionId: number): Promise<null> {
    return api.put<null>(`/api/turnos/asignaciones/${asignacionId}/sospechoso/descartar`);
  },

  /**
   * Marca egreso con firma digital (base64 PNG). Requiere ubicación GPS salvo
   * en cargos con tipo_geofence='libre' — igual que marcarIngreso.
   */
  marcarEgreso(asignacionId: number, firmaB64: string, latitud: number | undefined, longitud: number | undefined): Promise<Asignacion> {
    return api.post<Asignacion>(`/api/turnos/asignaciones/${asignacionId}/egreso`, {
      firma_b64: firmaB64,
      latitud,
      longitud,
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
    /** Uno o varios estados (ej. para "aceptados" = todo lo que alguna vez se confirmó). */
    estado?: EstadoAsignacion | EstadoAsignacion[];
    page?: number;
    limit?: number;
  }): Promise<PaginatedResponse<Asignacion>> {
    const qs = new URLSearchParams();
    if (params?.trabajador_id) qs.set('trabajador_id', String(params.trabajador_id));
    if (params?.oferta_id)     qs.set('oferta_id',     String(params.oferta_id));
    if (params?.fecha)          qs.set('fecha',          params.fecha);
    if (params?.estado)         qs.set('estado',         Array.isArray(params.estado) ? params.estado.join(',') : params.estado);
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
   * Agrega o edita el bono extra (ej. propina) de un turno puntual. Solo
   * gestores/admin, y solo mientras el contrato del turno no esté firmado.
   * `monto: 0` quita el bono.
   */
  agregarBono(asignacionId: number, datos: { monto: number; motivo?: string }): Promise<Asignacion> {
    return api.put<Asignacion>(`/api/turnos/asignaciones/${asignacionId}/bono`, datos);
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
