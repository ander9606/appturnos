export type Plan = 'basico' | 'profesional' | 'empresarial';

/** Fila de la tabla `planes` (backend) — precios editables por super_admin, COP/mes. */
export interface PlanConfig {
  codigo: Plan;
  nombre: string;
  orden: number;
  max_trabajadores: number | null;
  precio_cop: number;
  incluidos: number | null;
  precio_adicional_cop: number | null;
  updated_at: string;
}

export type ActualizarPlanPayload = Pick<PlanConfig, 'precio_cop' | 'max_trabajadores' | 'incluidos' | 'precio_adicional_cop'>;

/** Precio mensual de un plan para `trabajadores` activos — espejo de precioPlanCop (backend). */
export function precioPlan(p: PlanConfig, trabajadores: number): number {
  const extra = p.incluidos != null ? Math.max(0, trabajadores - p.incluidos) : 0;
  return p.precio_cop + extra * (p.precio_adicional_cop ?? 0);
}

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
  /** Derivado en vivo de integracion_config — no confundir con suscripcion_origen. */
  logiq360_conectado: boolean;
  /** Ingresos históricos (COP) generados por esta empresa vía Wompi. Solo en el listado. */
  ingresos_totales_cop?: number;
}

export type EstadoWompiEvento = 'recibido' | 'procesado' | 'error' | 'ignorado' | 'rechazado';

export interface WompiEvento {
  id: number;
  transaction_id: string;
  referencia: string | null;
  empresa_id: number | null;
  empresa_nombre: string | null;
  plan: Plan | null;
  meses: number | null;
  monto_cop: number | null;
  estado: EstadoWompiEvento;
  intentos: number;
  error_detalle: string | null;
  created_at: string;
  procesado_at: string | null;
}

export interface MrrMes {
  /** 'YYYY-MM' */
  mes: string;
  ingresos_cop: number;
}

export interface RenovacionRiesgo {
  id: number;
  nombre: string;
  vigente_hasta: string;
  /** Negativo = ya vencida hace N días. */
  dias_restantes: number;
}

export interface ReportesGlobales {
  empresas: { total: number; activas: number; inactivas: number };
  usuarios: { total: number };
  trabajadores: { total: number; activos: number };
  turnos: { ultimo_mes: number };
  nomina: { periodos_abiertos: number };
  integraciones: { logiq360: number; pago_directo: number };
  ingresos: {
    mes_actual: number;
    ganado_mes_pasado: number;
    proyeccion_mes_actual: number;
    planes: PlanConfig[];
    mrr_historico: MrrMes[];
  };
  renovaciones_riesgo: RenovacionRiesgo[];
}
