export type TipoContrato = 'laboral' | 'prestacion_servicios';

export interface Empresa {
  id: number;
  nombre: string;
  nit: string | null;
  direccion: string | null;
  telefono: string | null;
  email: string | null;
  logo_url: string | null;
  /** Determina si la liquidación de nómina calcula descuentos de ley (salud/pensión). */
  tipo_contrato: TipoContrato;
}

export type AlcancePunto = 'todos' | 'nomina';

export interface PuntoMarcaje {
  id: number;
  nombre: string;
  latitud: number;
  longitud: number;
  radio_metros: number;
  alcance: AlcancePunto;
  activo: number;
}

/** Ubicación de la biblioteca disponible para prellenar un turno (alcance='todos'). */
export interface PuntoParaTurno {
  id: number;
  nombre: string;
  latitud: number;
  longitud: number;
  radio_metros: number;
}

export interface Cargo {
  id: number;
  nombre: string;
  descripcion: string | null;
  activo: number;
}

export interface Gestor {
  id: number;
  nombre: string;
  apellido: string;
  email: string;
  rol: string;
  activo: number;
}

export interface Suscripcion {
  activa: boolean;
  plan: 'basico' | 'profesional' | 'empresarial';
  vigente_hasta: string | null;
  dias_restantes: number | null;
  origen: 'directo' | 'logiq360';
}

export interface LinkPago {
  url: string;
  referencia: string;
  monto_cop: number;
  expira_at: string;
}
