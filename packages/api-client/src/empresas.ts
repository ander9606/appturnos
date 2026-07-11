import { api } from './client';

// ── Tipos ─────────────────────────────────────────────────────────────────

export interface EmpresaDirectorio {
  id: number;
  nombre: string;
  slug: string;
  ciudad: string | null;
  logo_url: string | null;
  descripcion: string | null;
  acepta_postulaciones: boolean;
}

export type TipoLiquidacion = 'mensual' | 'quincenal' | 'semanal';

/** Vista completa que solo ve el admin_empresa de esa empresa */
export interface Empresa extends EmpresaDirectorio {
  nit: string | null;
  actividad: string | null;
  plan: string;
  tipo_liquidacion: TipoLiquidacion;
  created_at: string;
}

export interface ActualizarMiEmpresaPayload {
  nombre?: string;
  nit?: string;
  ciudad?: string;
  descripcion?: string;
  actividad?: string;
  logo_url?: string;
  acepta_postulaciones?: boolean;
  tipo_liquidacion?: TipoLiquidacion;
}

export interface DirectorioResponse {
  data: EmpresaDirectorio[];
  pagination: { page: number; limit: number; total: number };
}

// ── API ───────────────────────────────────────────────────────────────────

export const empresasApi = {
  async directorio(params: { busqueda?: string; ciudad?: string; page?: number; limit?: number } = {}): Promise<DirectorioResponse> {
    const qs = new URLSearchParams();
    if (params.busqueda) qs.set('busqueda', params.busqueda);
    if (params.ciudad)   qs.set('ciudad', params.ciudad);
    if (params.page)     qs.set('page', String(params.page));
    if (params.limit)    qs.set('limit', String(params.limit));
    const suffix = qs.toString() ? `?${qs}` : '';
    return api.get<DirectorioResponse>(`/api/empresas/directorio${suffix}`);
  },

  obtenerMiEmpresa(): Promise<Empresa> {
    return api.get<Empresa>('/api/empresas/me');
  },

  actualizarMiEmpresa(datos: ActualizarMiEmpresaPayload): Promise<Empresa> {
    return api.patch<Empresa>('/api/empresas/me', datos);
  },

  obtenerSuscripcion(): Promise<{
    activa: boolean;
    plan: string;
    vigente_hasta: string | null;
    dias_restantes: number | null;
    origen: 'logiq360' | 'directo';
    logiq360_conectado: boolean;
  }> {
    return api.get('/api/empresas/suscripcion');
  },

  /** Autoservicio: admin_empresa genera su propio link de pago Wompi (precio único). */
  generarLinkPago(payload: { meses?: number } = {}): Promise<{ url: string; referencia: string; monto_cop: number; expira_at: string }> {
    return api.post('/api/empresas/suscripcion/pagar', payload);
  },
};
