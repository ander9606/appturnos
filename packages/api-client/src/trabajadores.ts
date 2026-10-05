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
  /** Texto libre: qué sabe hacer el trabajador, visible para las empresas. */
  descripcion: string | null;
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
  /** Hora habitual de entrada (HH:MM:SS) — si está definida, dispara el recordatorio de inicio de turno. Solo aplica a nómina/ambos. */
  hora_entrada_esperada: string | null;
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
  descripcion?: string;
  tarifa_hora?: number;
  salario_base?: number;
  ant_judiciales_fecha?: string;
  ant_disciplinarios_fecha?: string;
  experiencias?: ExperienciaPayload[];
  diplomas?: DiplomaPayload[];
  cargo_ids?: number[];
  empresa_ids?: number[];
  external_ref?: string;
  /** HH:MM — pasar null/'' para desactivar el recordatorio. */
  hora_entrada_esperada?: string | null;
}

export interface ActualizarTrabajadorPayload extends Partial<CrearTrabajadorPayload> {}

/** Campos que el propio trabajador_turnos puede editar en su perfil. */
export interface UpdateMePayload {
  tipo_documento?: TipoDocumento;
  cedula?: string;
  fecha_nacimiento?: string;
  sexo?: SexoTrabajador;
  telefono?: string;
  descripcion?: string;
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

/** Un cambio de tarifa/salario de la auditoría legal. Solo lo ve admin_empresa. */
export interface CambioSalario {
  id: number;
  tarifa_hora_anterior: number | null;
  tarifa_hora_nueva: number | null;
  salario_base_anterior: number | null;
  salario_base_nueva: number | null;
  usuario_nombre: string;
  usuario_rol: string;
  ip: string | null;
  created_at: string;
}

export interface TrabajadorPreview {
  id: number;
  nombre: string;
  apellido: string;
  cedula: string;
  tipo_documento: string | null;
  cargo: string | null;
  ranking: number | null;
}

/** Fila del banco de talento — trabajador_turnos libre (sin empresa). */
export interface BancoTalentoWorker {
  id: number;
  nombre: string;
  apellido: string;
  cedula: string;
  tipo_documento: TipoDocumento | null;
  cargo: string | null;
  descripcion: string | null;
  ranking: number | null;
  total_calificaciones: number;
  foto_perfil: string | null;
  /** Historial de cargos en otras empresas — para decidir mejor a quién invitar. */
  experiencias: Experiencia[];
}

export interface BancoTalentoParams {
  /** Filtra por nombre, apellido o cargo (LIKE, insensible a mayúsculas en MySQL). */
  q?: string;
  page?: number;
  limit?: number;
}

export interface BancoTalentoResponse {
  data: BancoTalentoWorker[];
  pagination: { page: number; limit: number; total: number };
}

export const trabajadoresApi = {
  /** Búsqueda cross-empresa por cédula — solo devuelve marketplace workers activos. */
  buscarPorCedula(cedula: string): Promise<TrabajadorPreview> {
    return api.get<TrabajadorPreview>(`/api/trabajadores/buscar?cedula=${encodeURIComponent(cedula)}`);
  },

  /** Banco de talento: trabajadores_turnos libres, navegables/buscables por nombre o cargo. */
  bancoTalento(params: BancoTalentoParams = {}): Promise<BancoTalentoResponse> {
    const qs = new URLSearchParams();
    if (params.q) qs.set('q', params.q);
    if (params.page !== undefined) qs.set('page', String(params.page));
    if (params.limit !== undefined) qs.set('limit', String(params.limit));
    const suffix = qs.toString() ? `?${qs}` : '';
    return api.get<BancoTalentoResponse>(`/api/trabajadores/banco-talento${suffix}`);
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

  /** admin/jefe_nomina: cambiar tarifa/salario. Avisa a admins (si lo hace jefe_nomina) y al trabajador. */
  actualizarSalario: (
    id: number,
    data: { tarifa_hora: number | null; salario_base: number | null }
  ): Promise<Trabajador> =>
    api.patch<Trabajador>(`/api/trabajadores/${id}/salario`, data),

  /** admin_empresa: auditoría legal de cambios de sueldo. */
  historialSalario: (id: number): Promise<CambioSalario[]> =>
    api.get<CambioSalario[]>(`/api/trabajadores/${id}/historial-salario`),

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
