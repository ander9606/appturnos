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
