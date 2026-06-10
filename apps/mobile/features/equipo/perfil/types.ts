import type { TipoTrabajador } from '@api-client';

export type TipoDocumento = 'CC' | 'CE' | 'PAS';
export type Sexo = 'M' | 'F' | 'otro';
export type TipoCuenta = 'ahorros' | 'corriente';

export interface ExperienciaInput {
  _id: string;
  empresa_nombre: string;
  cargo: string;
  inicio_m: string;
  inicio_a: string;
  fin_m: string;
  fin_a: string;
}

export interface DiplomaInput {
  _id: string;
  titulo: string;
  institucion: string;
  anio: string;
}

export interface WizardData {
  // Paso 1 — Datos personales
  nombre: string;
  apellido: string;
  tipo: TipoTrabajador;
  tipo_documento: TipoDocumento;
  cedula: string;
  nac_d: string;
  nac_m: string;
  nac_a: string;
  sexo: Sexo | '';
  telefono: string;
  email: string;
  emergencia_nombre: string;
  emergencia_tel: string;
  // Paso 2 — Seguridad social y pago
  eps: string;
  afp: string;
  banco: string;
  tipo_cuenta: TipoCuenta | '';
  numero_cuenta: string;
  tarifa_hora: string;
  salario_base: string;
  // Paso 3 — Documentos y cargos
  antj_d: string;
  antj_m: string;
  antj_a: string;
  antd_d: string;
  antd_m: string;
  antd_a: string;
  experiencias: ExperienciaInput[];
  diplomas: DiplomaInput[];
  cargo_ids: number[];
  // Paso 4 — Empresas donde quiere trabajar
  empresa_ids: number[];
}

export const INITIAL: WizardData = {
  nombre: '', apellido: '', tipo: 'turnos',
  tipo_documento: 'CC', cedula: '',
  nac_d: '', nac_m: '', nac_a: '',
  sexo: '',
  telefono: '', email: '',
  emergencia_nombre: '', emergencia_tel: '',
  eps: '', afp: '',
  banco: '', tipo_cuenta: '', numero_cuenta: '',
  tarifa_hora: '', salario_base: '',
  antj_d: '', antj_m: '', antj_a: '',
  antd_d: '', antd_m: '', antd_a: '',
  experiencias: [],
  diplomas: [],
  cargo_ids: [],
  empresa_ids: [],
};
