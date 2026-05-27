import { api } from './client';

// ── Types ─────────────────────────────────────────────────────────────────

export type PlanEmpresa = 'basico' | 'profesional' | 'empresarial';

export interface EmpresaAdmin {
  id: number;
  nombre: string;
  slug: string;
  nit: string | null;
  ciudad: string | null;
  activo: number; // 0 | 1 (MySQL TINYINT)
  plan: PlanEmpresa;
  acepta_postulaciones: number;
  logo_url: string | null;
  descripcion: string | null;
  total_trabajadores: number;
  total_usuarios: number;
  total_ofertas?: number;
  total_periodos?: number;
  created_at: string;
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
  distribucion_planes: Partial<Record<PlanEmpresa, number>>;
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

  async crearEmpresa(datos: CrearEmpresaPayload): Promise<EmpresaAdmin> {
    return api.post<EmpresaAdmin>('/api/admin/empresas', datos);
  },

  async actualizarEmpresa(id: number, datos: ActualizarEmpresaPayload): Promise<EmpresaAdmin> {
    return api.put<EmpresaAdmin>(`/api/admin/empresas/${id}`, datos);
  },

  async cambiarEstadoEmpresa(id: number, activo: boolean): Promise<EmpresaAdmin> {
    return api.patch<EmpresaAdmin>(`/api/admin/empresas/${id}/estado`, { activo });
  },

  // ── Reportes ──────────────────────────────────────────────────────────────

  async reportesGlobales(): Promise<ReportesGlobales> {
    return api.get<ReportesGlobales>('/api/admin/reportes/global');
  },
};
