export type Plan = 'basico' | 'profesional' | 'empresarial';

export type OrigenSuscripcion = 'manual' | 'wompi' | 'logiq360';

export interface EmpresaAdmin {
  id: number;
  nombre: string;
  slug: string;
  nit: string | null;
  ciudad: string | null;
  activo: boolean | number;
  plan: Plan;
  suscripcion_vigente_hasta: string | null;
  suscripcion_origen: OrigenSuscripcion;
  acepta_postulaciones: boolean | number;
  logo_url: string | null;
  descripcion: string | null;
  created_at: string;
  total_trabajadores: number;
  total_usuarios: number;
  total_ofertas?: number;
  total_periodos?: number;
}

export type EstadoWompiEvento = 'recibido' | 'procesado' | 'error' | 'ignorado';

export interface WompiEvento {
  id: number;
  transaction_id: string;
  referencia: string | null;
  empresa_id: number | null;
  plan: Plan | null;
  meses: number | null;
  estado: EstadoWompiEvento;
  intentos: number;
  error_detalle: string | null;
  created_at: string;
  procesado_at: string | null;
}

export interface ReportesGlobales {
  empresas: { total: number; activas: number; inactivas: number };
  usuarios: { total: number };
  trabajadores: { total: number; activos: number };
  turnos: { ultimo_mes: number };
  nomina: { periodos_abiertos: number };
  distribucion_planes: Partial<Record<Plan, number>>;
}
