import { formatCOP } from '@/lib/formatters';

// Lo que jefe_nomina puede editar de una ficha. Mismo criterio que el backend
// (CAMPOS_JEFE_NOMINA / CAMPOS_JEFE_TURNOS en trabajadores.service.js): sin tipo ni datos de pago.
export const CAMPOS_JEFE = [
  'nombre', 'apellido', 'cedula', 'tipo_documento', 'fecha_nacimiento', 'sexo',
  'telefono', 'email', 'cargo', 'descripcion', 'eps', 'afp', 'direccion',
  'contacto_emergencia_nombre', 'contacto_emergencia_tel',
  'ant_judiciales_fecha', 'ant_disciplinarios_fecha', 'hora_entrada_esperada',
  'tarifa_hora', 'salario_base',
];
// Turnos: sin sueldo ni hora de entrada, y sin los datos de persona que se copian a sus otras empresas (solo admin).
export const CAMPOS_JEFE_TURNOS = ['nombre', 'apellido', 'telefono', 'email', 'cargo'];

export function filtrarCampos<T extends object>(obj: T, campos: readonly string[]): Partial<T> {
  return Object.fromEntries(Object.entries(obj).filter(([k]) => campos.includes(k))) as Partial<T>;
}

export const TIPO_LABELS: Record<string, string> = {
  turnos: 'Turnos',
  nomina: 'Nómina',
  ambos:  'Ambos',
};

export const TIPO_DOC_LABELS: Record<string, string> = {
  CC: 'Cédula (CC)',
  CE: 'Cédula Ext. (CE)',
  PAS: 'Pasaporte',
};

export const SEXO_LABELS: Record<string, string> = {
  M: 'Masculino',
  F: 'Femenino',
  otro: 'Otro',
};

export const TIPO_CUENTA_LABELS: Record<string, string> = {
  ahorros: 'Ahorros',
  corriente: 'Corriente',
};

export function fmtFechaCorta(iso: string | null | undefined) {
  if (!iso) return null;
  return new Date(iso.slice(0, 10) + 'T00:00:00').toLocaleDateString('es-CO', {
    year: 'numeric', month: 'long', day: 'numeric',
  });
}

export function fmtCopOpt(v: number | null) {
  return v == null ? '—' : formatCOP(v);
}
