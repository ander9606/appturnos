export type TipoTrabajador = 'nomina' | 'turnos' | 'ambos';
export type TipoDocumento = 'CC' | 'CE' | 'PAS';
export type Sexo = 'M' | 'F' | 'otro';
export type TipoCuenta = 'ahorros' | 'corriente';

export interface Trabajador {
  id: number;
  nombre: string;
  apellido: string;
  cedula: string | null;
  tipo_documento: TipoDocumento;
  tipo: TipoTrabajador;
  cargo: string | null;
  email: string | null;
  telefono: string | null;
  tarifa_hora: number | null;
  salario_base: number | null;
  activo: number;
  sexo: Sexo | null;
  fecha_nacimiento: string | null;
  eps: string | null;
  afp: string | null;
  banco: string | null;
  tipo_cuenta: TipoCuenta | null;
  numero_cuenta: string | null;
  contacto_emergencia_nombre: string | null;
  contacto_emergencia_tel: string | null;
  ranking: number;
  created_at: string;
  /** Hora habitual de entrada (HH:MM:SS) — si está definida, dispara el recordatorio de inicio de turno. Solo aplica a nómina/ambos. */
  hora_entrada_esperada: string | null;
  /** Promedio de `pago_total` de sus asignaciones completadas. null si es tipo nómina o si (tipo turnos) aún no completó ninguna. */
  promedio_pago_turno: number | null;
}

export interface Experiencia {
  id: number;
  empresa_nombre: string;
  cargo: string;
  fecha_inicio: string;
  fecha_fin: string | null;
}

/** Fila del banco de talento — trabajador_turnos libre (sin empresa), aún no vinculado a ninguna. */
export interface BancoTalentoWorker {
  id: number;
  nombre: string;
  apellido: string;
  /** null si el trabajador nunca registró su cédula — la invitación se hace por cédula, así que no se puede invitar. */
  cedula: string | null;
  tipo_documento: TipoDocumento | null;
  cargo: string | null;
  descripcion: string | null;
  ranking: number | null;
  total_calificaciones: number;
  foto_perfil: string | null;
  /** Historial de cargos en otras empresas. */
  experiencias: Experiencia[];
}

/** Un cambio de tarifa/salario registrado para auditoría legal. Solo lo ve admin_empresa. */
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
