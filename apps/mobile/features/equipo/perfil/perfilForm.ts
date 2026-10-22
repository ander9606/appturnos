import type { Trabajador, TipoDocumento, SexoTrabajador, TipoCuenta } from '@api-client';

// ── Tipos de estado para formularios inline ─────────────────────────────────

export const EMPTY_EXP = { empresa_nombre: '', cargo: '', fecha_inicio: '', fecha_fin: '' };
export const EMPTY_DIP = { titulo: '', institucion: '', anio: '' };

export interface FormState {
  tipo_documento: TipoDocumento;
  cedula: string;
  fecha_nacimiento: string;
  sexo: SexoTrabajador | '';
  telefono: string;
  descripcion: string;
  direccion: string;
  eps: string;
  afp: string;
  banco: string;
  tipo_cuenta: TipoCuenta | '';
  numero_cuenta: string;
  contacto_emergencia_nombre: string;
  contacto_emergencia_tel: string;
  ant_judiciales_fecha: string;
  ant_disciplinarios_fecha: string;
}

export function buildForm(t: Trabajador | undefined): FormState {
  return {
    tipo_documento:              (t?.tipo_documento ?? 'CC') as TipoDocumento,
    cedula:                      t?.cedula ?? '',
    fecha_nacimiento:            t?.fecha_nacimiento?.slice(0, 10) ?? '',
    sexo:                        t?.sexo ?? '',
    telefono:                    t?.telefono ?? '',
    descripcion:                 t?.descripcion ?? '',
    direccion:                   t?.direccion ?? '',
    eps:                         t?.eps ?? '',
    afp:                         t?.afp ?? '',
    banco:                       t?.banco ?? '',
    tipo_cuenta:                 t?.tipo_cuenta ?? '',
    numero_cuenta:               t?.numero_cuenta ?? '',
    contacto_emergencia_nombre:  t?.contacto_emergencia_nombre ?? '',
    contacto_emergencia_tel:     t?.contacto_emergencia_tel ?? '',
    ant_judiciales_fecha:        t?.ant_judiciales_fecha?.slice(0, 10) ?? '',
    ant_disciplinarios_fecha:    t?.ant_disciplinarios_fecha?.slice(0, 10) ?? '',
  };
}
