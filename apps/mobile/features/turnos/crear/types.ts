export type PuestoInput = {
  key: string;
  cargo_id: number;
  cargo_nombre: string;
  plazas: number;
  tarifa_dia: string; // string for TextInput, parsed on submit
};

export type DestinatarioInput = {
  id: number; // trabajador_id
  nombre: string;
  apellido: string;
};

export type WizardData = {
  titulo: string;
  descripcion: string;
  fecha: Date | null;
  hora_inicio: Date | null;
  hora_fin: Date | null;
  lugar: string;
  latitud: number | null;
  longitud: number | null;
  encargado_nombre: string;
  encargado_telefono: string;
  para_quien: 'turnos' | 'nomina' | 'ambos';
  visibilidad: 'abierta' | 'dirigida';
  destinatarios: DestinatarioInput[];
  puestos: PuestoInput[];
};

export const INITIAL: WizardData = {
  titulo: '',
  descripcion: '',
  fecha: null,
  hora_inicio: null,
  hora_fin: null,
  lugar: '',
  latitud: null,
  longitud: null,
  encargado_nombre: '',
  encargado_telefono: '',
  para_quien: 'turnos',
  visibilidad: 'abierta',
  destinatarios: [],
  puestos: [],
};
