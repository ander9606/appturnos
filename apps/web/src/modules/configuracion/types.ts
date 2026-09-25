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
export type TipoPunto = 'fijo' | 'zonal';

export interface PuntoMarcaje {
  id: number;
  nombre: string;
  latitud: number;
  longitud: number;
  radio_metros: number;
  alcance: AlcancePunto;
  /** 'zonal' = cualquier punto de ese tipo es válido para el geofence (ver ZonasMarcajeInput). Default 'fijo'. */
  tipo?: TipoPunto;
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

export type PlanCodigo = 'basico' | 'profesional' | 'empresarial';

/** Un plan tal como lo ve el admin_empresa, con el precio que pagaría hoy. */
export interface PlanOpcion {
  codigo: PlanCodigo;
  nombre: string;
  max_trabajadores: number | null;
  incluidos: number | null;
  precio_adicional_cop: number | null;
  /** Precio mensual con sus trabajadores activos actuales (incluye adicionales). */
  precio_mensual_cop: number;
  /** false si el tope del plan es menor que sus trabajadores activos. */
  disponible: boolean;
}

export interface Suscripcion {
  activa: boolean;
  plan: PlanCodigo;
  vigente_hasta: string | null;
  dias_restantes: number | null;
  origen: 'directo' | 'logiq360';
  trabajadores_activos: number;
  /** Tope del plan actual; null = sin tope. */
  max_trabajadores: number | null;
  planes: PlanOpcion[];
}

export interface LinkPago {
  url: string;
  referencia: string;
  plan: PlanCodigo;
  monto_cop: number;
  expira_at: string;
}
