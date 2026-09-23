import { api } from './client';

// ── Types ─────────────────────────────────────────────────────────────────

export type PlanEmpresa = 'basico' | 'profesional' | 'empresarial';

/** Fila de la tabla `planes` — precios editables por super_admin (COP/mes). */
export interface PlanConfig {
  codigo: PlanEmpresa;
  nombre: string;
  orden: number;
  /** null = sin tope de trabajadores activos. */
  max_trabajadores: number | null;
  precio_cop: number;
  /** Trabajadores cubiertos por precio_cop; null = no cobra adicionales. */
  incluidos: number | null;
  precio_adicional_cop: number | null;
  updated_at: string;
}

export type ActualizarPlanPayload = Pick<PlanConfig, 'precio_cop' | 'max_trabajadores' | 'incluidos' | 'precio_adicional_cop'>;

/**
 * Precio mensual de un plan para `activos` trabajadores activos — espejo de
 * precioPlanCop (backend/modules/suscripciones/planes.model.js). Solo para
 * vistas previas: el monto que se cobra lo calcula siempre el backend.
 */
export function precioPlanCop(
  plan: Pick<PlanConfig, 'precio_cop' | 'incluidos' | 'precio_adicional_cop'>,
  activos: number,
): number {
  const extra = plan.incluidos != null ? Math.max(0, activos - plan.incluidos) : 0;
  return plan.precio_cop + extra * (plan.precio_adicional_cop ?? 0);
}

export type SuscripcionOrigen = 'manual' | 'wompi' | 'logiq360';

export interface EmpresaAdmin {
  id: number;
  nombre: string;
  slug: string;
  nit: string | null;
  ciudad: string | null;
  activo: number; // 0 | 1 (MySQL TINYINT)
  plan: PlanEmpresa;
  suscripcion_vigente_hasta: string | null; // null = indefinida
  suscripcion_origen: SuscripcionOrigen;
  acepta_postulaciones: number;
  logo_url: string | null;
  descripcion: string | null;
  total_trabajadores: number;
  total_usuarios: number;
  trabajadores_turnos: number;
  trabajadores_nomina: number;
  trabajadores_ambos: number;
  logiq360_conectado: boolean;
  /** Ingresos históricos (COP) generados por esta empresa vía Wompi. */
  ingresos_totales_cop?: number;
  total_ofertas?: number;
  total_periodos?: number;
  created_at: string;
}

export interface EmpresaCreada extends EmpresaAdmin {
  admin_creado: boolean;
  credenciales_email_enviado: boolean;
}

export interface EmpresasListResponse {
  data: EmpresaAdmin[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface EmpresasListParams {
  busqueda?: string;
  activo?: boolean;
  plan?: PlanEmpresa;
  page?: number;
  limit?: number;
}

export interface CrearEmpresaPayload {
  nombre: string;
  slug: string;
  nit?: string | null;
  ciudad?: string | null;
  plan?: PlanEmpresa;
  descripcion?: string | null;
  /** admin_nombre y admin_email deben enviarse juntos — crean el admin_empresa y le envían credenciales por correo. */
  admin_nombre?: string;
  admin_email?: string;
}

export interface ActualizarEmpresaPayload {
  nombre?: string;
  nit?: string | null;
  ciudad?: string | null;
  plan?: PlanEmpresa;
  acepta_postulaciones?: boolean;
  descripcion?: string | null;
  logo_url?: string | null;
}

export interface ReportesGlobales {
  empresas: {
    total: number;
    activas: number;
    inactivas: number;
  };
  usuarios: {
    total: number;
  };
  trabajadores: {
    total: number;
    activos: number;
  };
  turnos: {
    ultimo_mes: number;
  };
  nomina: {
    periodos_abiertos: number;
  };
  integraciones: {
    logiq360: number;
    pago_directo: number;
  };
  ingresos: {
    mes_actual: number;
    proyeccion_mes_actual: number;
    ganado_mes_pasado: number;
    planes: PlanConfig[];
    mrr_historico: { mes: string; ingresos_cop: number }[];
  };
  renovaciones_riesgo: {
    id: number;
    nombre: string;
    vigente_hasta: string;
    dias_restantes: number;
  }[];
}

export interface LinkPagoResponse {
  url: string;
  referencia: string;
  plan: PlanEmpresa;
  monto_cop: number;
  expira_at: string;
}

export type WompiEstado = 'recibido' | 'procesado' | 'error' | 'ignorado' | 'rechazado';

export interface WompiEvento {
  id: number;
  transaction_id: string;
  referencia: string | null;
  empresa_id: number | null;
  empresa_nombre: string | null;
  plan: PlanEmpresa | null;
  meses: number | null;
  /** Monto real cobrado por Wompi (COP). */
  monto_cop: number | null;
  estado: WompiEstado;
  intentos: number;
  error_detalle: string | null;
  created_at: string;
  procesado_at: string | null;
}

export interface WompiEventosParams {
  estado?: WompiEstado;
  page?: number;
  limit?: number;
}

export interface WompiEventosResponse {
  data: WompiEvento[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

// ── API ───────────────────────────────────────────────────────────────────

export const adminApi = {
  // ── Empresas ─────────────────────────────────────────────────────────────

  async listarEmpresas(params: EmpresasListParams = {}): Promise<EmpresasListResponse> {
    const qs = new URLSearchParams();
    if (params.busqueda) qs.set('busqueda', params.busqueda);
    if (params.activo !== undefined) qs.set('activo', String(params.activo));
    if (params.plan) qs.set('plan', params.plan);
    if (params.page) qs.set('page', String(params.page));
    if (params.limit) qs.set('limit', String(params.limit));

    const query = qs.toString() ? `?${qs.toString()}` : '';
    return api.get<EmpresasListResponse>(`/api/admin/empresas${query}`);
  },

  async obtenerEmpresa(id: number): Promise<EmpresaAdmin> {
    return api.get<EmpresaAdmin>(`/api/admin/empresas/${id}`);
  },

  async crearEmpresa(datos: CrearEmpresaPayload): Promise<EmpresaCreada> {
    return api.post<EmpresaCreada>('/api/admin/empresas', datos);
  },

  async actualizarEmpresa(id: number, datos: ActualizarEmpresaPayload): Promise<EmpresaAdmin> {
    return api.put<EmpresaAdmin>(`/api/admin/empresas/${id}`, datos);
  },

  async cambiarEstadoEmpresa(id: number, activo: boolean): Promise<EmpresaAdmin> {
    return api.patch<EmpresaAdmin>(`/api/admin/empresas/${id}/estado`, { activo });
  },

  async generarLinkPago(id: number, datos: { plan: PlanEmpresa; meses?: number }): Promise<LinkPagoResponse> {
    return api.post<LinkPagoResponse>(`/api/admin/empresas/${id}/link-pago`, datos);
  },

  // ── Planes y precios ─────────────────────────────────────────────────────

  async listarPlanes(): Promise<PlanConfig[]> {
    return api.get<PlanConfig[]>('/api/admin/planes');
  },

  /** Devuelve la lista completa actualizada. Aplica a los próximos links de pago. */
  async actualizarPlan(codigo: PlanEmpresa, datos: ActualizarPlanPayload): Promise<PlanConfig[]> {
    return api.put<PlanConfig[]>(`/api/admin/planes/${codigo}`, datos);
  },

  // ── Wompi eventos ────────────────────────────────────────────────────────

  async listarWompiEventos(params: WompiEventosParams = {}): Promise<WompiEventosResponse> {
    const qs = new URLSearchParams();
    if (params.estado) qs.set('estado', params.estado);
    if (params.page) qs.set('page', String(params.page));
    if (params.limit) qs.set('limit', String(params.limit));
    const query = qs.toString() ? `?${qs.toString()}` : '';
    return api.get<WompiEventosResponse>(`/api/admin/wompi-eventos${query}`);
  },

  async reintentarWompiEvento(id: number): Promise<{ ok: boolean; empresaId: number; plan: string; meses: number }> {
    return api.post(`/api/admin/wompi-eventos/${id}/reintentar`);
  },

  // ── Reportes ──────────────────────────────────────────────────────────────

  async reportesGlobales(): Promise<ReportesGlobales> {
    return api.get<ReportesGlobales>('/api/admin/reportes/global');
  },
};
