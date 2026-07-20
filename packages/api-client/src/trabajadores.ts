import { api } from './client';
import type { TipoTrabajador } from './types';

// ── Types ─────────────────────────────────────────────────────────────────

export interface DisponibilidadSlot {
  id?: number;
  dia_semana: number; // 0=dom, 1=lun, ..., 6=sab
  hora_inicio: string; // HH:MM
  hora_fin: string;    // HH:MM
  activo: boolean;
}

export type TipoDocumento = 'CC' | 'CE' | 'PAS';
export type SexoTrabajador = 'M' | 'F' | 'otro';
export type TipoCuenta = 'ahorros' | 'corriente';

export interface Trabajador {
  id: number;
  empresa_id: number;
  usuario_id: number | null;
  nombre: string;
  apellido: string;
  foto_perfil: string | null;
  cedula: string | null;
  tipo_documento: TipoDocumento | null;
  fecha_nacimiento: string | null;
  sexo: SexoTrabajador | null;
  contacto_emergencia_nombre: string | null;
  contacto_emergencia_tel: string | null;
  telefono: string | null;
  email: string | null;
  tipo: TipoTrabajador;
  cargo: string | null;
  tarifa_hora: number | null;
  salario_base: number | null;
  acepta_extras: boolean;
  eps: string | null;
  afp: string | null;
  banco: string | null;
  tipo_cuenta: TipoCuenta | null;
  numero_cuenta: string | null;
  ant_judiciales_fecha: string | null;
  ant_disciplinarios_fecha: string | null;
  tipo_marcacion: 'libre' | 'fijo' | 'zonal';
  punto_marcaje_id: number | null;
  activo: boolean;
  external_ref: string | null;
  ranking: number | null;
  total_calificaciones: number;
  created_at: string;
  // Incluidos solo en GET /api/trabajadores/me
  experiencias?: Experiencia[];
  diplomas?: Diploma[];
  cargos?: CargoAsignado[];
}

export interface TrabajadoresListParams {
  tipo?: TipoTrabajador;
  activo?: boolean;
  page?: number;
  limit?: number;
}

export interface TrabajadoresListResponse {
  data: Trabajador[];
  pagination: { page: number; limit: number; total: number };
}

export interface Experiencia {
  id: number;
  trabajador_id: number;
  empresa_nombre: string;
  cargo: string;
  fecha_inicio: string;
  fecha_fin: string | null;
}

export interface Diploma {
  id: number;
  trabajador_id: number;
  titulo: string;
  institucion: string;
  anio: number | null;
}

export interface CargoAsignado {
  id: number;
  nombre: string;
  codigo: string | null;
}

export type ExperienciaPayload = Omit<Experiencia, 'id' | 'trabajador_id'>;
export type DiplomaPayload     = Omit<Diploma, 'id' | 'trabajador_id'>;

export interface CrearTrabajadorPayload {
  nombre: string;
  apellido: string;
  tipo?: TipoTrabajador;
  tipo_documento?: TipoDocumento;
  cedula?: string;
  fecha_nacimiento?: string;
  sexo?: SexoTrabajador;
  email?: string;
  telefono?: string;
  contacto_emergencia_nombre?: string;
  contacto_emergencia_tel?: string;
  eps?: string;
  afp?: string;
  banco?: string;
  tipo_cuenta?: TipoCuenta;
  numero_cuenta?: string;
  cargo?: string;
  tarifa_hora?: number;
  salario_base?: number;
  ant_judiciales_fecha?: string;
  ant_disciplinarios_fecha?: string;
  experiencias?: ExperienciaPayload[];
  diplomas?: DiplomaPayload[];
  cargo_ids?: number[];
  empresa_ids?: number[];
  external_ref?: string;
}

export interface ActualizarTrabajadorPayload extends Partial<CrearTrabajadorPayload> {}

/** Campos que el propio trabajador_turnos puede editar en su perfil. */
export interface UpdateMePayload {
  tipo_documento?: TipoDocumento;
  cedula?: string;
  fecha_nacimiento?: string;
  sexo?: SexoTrabajador;
  telefono?: string;
  contacto_emergencia_nombre?: string;
  contacto_emergencia_tel?: string;
  eps?: string;
  afp?: string;
  banco?: string;
  tipo_cuenta?: TipoCuenta;
  numero_cuenta?: string;
  ant_judiciales_fecha?: string;
  ant_disciplinarios_fecha?: string;
}

// ── API ───────────────────────────────────────────────────────────────────

export interface TrabajadorPreview {
  id: number;
  nombre: string;
  apellido: string;
  cedula: string;
  tipo_documento: string | null;
  cargo: string | null;
  ranking: number | null;
}

export const trabajadoresApi = {
  /** Búsqueda cross-empresa por cédula — solo devuelve marketplace workers activos. */
  buscarPorCedula(cedula: string): Promise<TrabajadorPreview> {
    return api.get<TrabajadorPreview>(`/api/trabajadores/buscar?cedula=${encodeURIComponent(cedula)}`);
  },

  async listar(params: TrabajadoresListParams = {}): Promise<TrabajadoresListResponse> {
    const qs = new URLSearchParams();
    if (params.tipo !== undefined) qs.set('tipo', params.tipo);
    if (params.activo !== undefined) qs.set('activo', String(params.activo));
    if (params.page !== undefined) qs.set('page', String(params.page));
    if (params.limit !== undefined) qs.set('limit', String(params.limit));
    const suffix = qs.toString() ? `?${qs}` : '';
    return api.get<TrabajadoresListResponse>(`/api/trabajadores${suffix}`);
  },

  obtener: (id: number): Promise<Trabajador> =>
    api.get<Trabajador>(`/api/trabajadores/${id}`),

  crear: (payload: CrearTrabajadorPayload): Promise<Trabajador> =>
    api.post<Trabajador>('/api/trabajadores', payload),

  actualizar: (id: number, payload: ActualizarTrabajadorPayload): Promise<Trabajador> =>
    api.put<Trabajador>(`/api/trabajadores/${id}`, payload),

  desactivar: (id: number): Promise<void> =>
    api.delete<void>(`/api/trabajadores/${id}`),

  /** Borra definitivamente un trabajador desactivado sin historial (turnos/nómina/calificaciones). */
  eliminarDefinitivo: (id: number): Promise<void> =>
    api.delete<void>(`/api/trabajadores/${id}/definitivo`),

  /** Cargos certificados del trabajador en mi empresa. */
  listarCargos: (id: number): Promise<CargoAsignado[]> =>
    api.get<CargoAsignado[]>(`/api/trabajadores/${id}/cargos`),

  /** Certifica al trabajador para un cargo del catálogo. */
  asignarCargo: (id: number, cargoId: number): Promise<CargoAsignado[]> =>
    api.post<CargoAsignado[]>(`/api/trabajadores/${id}/cargos`, { cargo_id: cargoId }),

  /** Quita una certificación de cargo. */
  desasignarCargo: (id: number, cargoId: number): Promise<CargoAsignado[]> =>
    api.delete<CargoAsignado[]>(`/api/trabajadores/${id}/cargos/${cargoId}`),

  /** Trabajador: obtener su propio perfil laboral completo. */
  me: (): Promise<Trabajador> =>
    api.get<Trabajador>('/api/trabajadores/me'),

  /** Trabajador: actualizar sus propios datos de perfil. */
  updateMe: (payload: UpdateMePayload): Promise<Trabajador> =>
    api.patch<Trabajador>('/api/trabajadores/me', payload),

  /** admin/jefe_nomina: actualizar tipo de marcación y punto asignado al trabajador. */
  actualizarMarcacion: (
    id: number,
    data: { tipo_marcacion: 'libre' | 'fijo' | 'zonal'; punto_marcaje_id?: number | null }
  ): Promise<Trabajador> =>
    api.patch<Trabajador>(`/api/trabajadores/${id}/marcacion`, data),

  /** trabajador_nomina: activar/desactivar opción de turnos extra. */
  actualizarExtras: (acepta_extras: boolean): Promise<Trabajador> =>
    api.patch<Trabajador>('/api/trabajadores/me/extras', { acepta_extras }),

  crearExperiencia: (payload: ExperienciaPayload): Promise<Experiencia> =>
    api.post<Experiencia>('/api/trabajadores/me/experiencias', payload),

  eliminarExperiencia: (expId: number): Promise<void> =>
    api.delete<void>(`/api/trabajadores/me/experiencias/${expId}`),

  crearDiploma: (payload: DiplomaPayload): Promise<Diploma> =>
    api.post<Diploma>('/api/trabajadores/me/diplomas', payload),

  eliminarDiploma: (dipId: number): Promise<void> =>
    api.delete<void>(`/api/trabajadores/me/diplomas/${dipId}`),

  /** Disponibilidad semanal propia (trabajador). */
  obtenerDisponibilidad: (): Promise<DisponibilidadSlot[]> =>
    api.get<DisponibilidadSlot[]>('/api/trabajadores/me/disponibilidad'),

  /** Guardar disponibilidad semanal (reemplaza todos los slots). */
  guardarDisponibilidad: (slots: DisponibilidadSlot[]): Promise<DisponibilidadSlot[]> =>
    api.put<DisponibilidadSlot[]>('/api/trabajadores/me/disponibilidad', { slots }),

  /** Gestor: ver disponibilidad de un trabajador específico (read-only). */
  obtenerDisponibilidadTrabajador: (id: number): Promise<DisponibilidadSlot[]> =>
    api.get<DisponibilidadSlot[]>(`/api/trabajadores/${id}/disponibilidad`),
};
