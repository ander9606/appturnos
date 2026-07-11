export interface Empresa {
  id: number;
  nombre: string;
  nit: string | null;
  direccion: string | null;
  telefono: string | null;
  email: string | null;
  logo_url: string | null;
}

export interface PuntoMarcaje {
  id: number;
  nombre: string;
  latitud: number;
  longitud: number;
  radio_metros: number;
  activo: number;
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
