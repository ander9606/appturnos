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
}
