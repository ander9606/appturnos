export type PuestoInput = {
  key: string;
  cargo_id: number;
  cargo_nombre: string;
  plazas: number;
  tarifa_dia: string; // string for TextInput, parsed on submit
};

export type WizardData = {
  titulo: string;
  descripcion: string;
  dia: string;   // DD
  mes: string;   // MM
  anio: string;  // YYYY
  hora_inicio_h: string;
  hora_inicio_m: string;
  hora_fin_h: string;
  hora_fin_m: string;
  lugar: string;
  latitud: number | null;
  longitud: number | null;
  para_quien: 'turnos' | 'nomina' | 'ambos';
  puestos: PuestoInput[];
};

export const INITIAL: WizardData = {
  titulo: '',
  descripcion: '',
  dia: '',
  mes: '',
  anio: '',
  hora_inicio_h: '',
  hora_inicio_m: '',
  hora_fin_h: '',
  hora_fin_m: '',
  lugar: '',
  latitud: null,
  longitud: null,
  para_quien: 'turnos',
  puestos: [],
};
