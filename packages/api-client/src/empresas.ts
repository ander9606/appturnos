import { api } from './client';
import type { PlanEmpresa } from './admin';

// ── Tipos ─────────────────────────────────────────────────────────────────

/** Un plan tal como lo ve el admin_empresa: con el precio que pagaría hoy. */
export interface PlanOpcion {
  codigo: PlanEmpresa;
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
  plan: PlanEmpresa;
  vigente_hasta: string | null;
  dias_restantes: number | null;
  origen: 'logiq360' | 'directo';
  logiq360_conectado: boolean;
  trabajadores_activos: number;
  /** Tope del plan actual; null = sin tope. */
  max_trabajadores: number | null;
  planes: PlanOpcion[];
}

export interface EmpresaDirectorio {
  id: number;
  nombre: string;
  slug: string;
  ciudad: string | null;
  logo_url: string | null;
  descripcion: string | null;
  acepta_postulaciones: boolean;
  /** Cargos activos en la empresa — informativo, la empresa decide cuál asignar al aprobar. */
  cargos: { id: number; nombre: string }[];
}

export type TipoLiquidacion = 'mensual' | 'quincenal' | 'semanal';

/** 'laboral' aplica descuentos de ley (salud/pensión) en la liquidación; 'prestacion_servicios' no. */
export type TipoContrato = 'laboral' | 'prestacion_servicios';

/** Vista completa que solo ve el admin_empresa de esa empresa */
export interface Empresa extends EmpresaDirectorio {
  nit: string | null;
  actividad: string | null;
  plan: string;
  tipo_liquidacion: TipoLiquidacion;
  tipo_contrato: TipoContrato;
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
  tipo_contrato?: TipoContrato;
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

  obtenerSuscripcion(): Promise<Suscripcion> {
    return api.get('/api/empresas/suscripcion');
  },

  /**
   * Autoservicio: admin_empresa genera su propio link de pago Wompi.
   * Sin `plan` renueva el actual; con `plan` amplía (o reduce) — el backend
   * rechaza (422) un plan cuyo tope no admite sus trabajadores activos.
   */
  generarLinkPago(payload: { meses?: number; plan?: PlanEmpresa } = {}): Promise<{ url: string; referencia: string; plan: PlanEmpresa; monto_cop: number; expira_at: string }> {
    return api.post('/api/empresas/suscripcion/pagar', payload);
  },
};
