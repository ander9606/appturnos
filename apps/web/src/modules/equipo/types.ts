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
