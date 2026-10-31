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
  /** Año completo (12 meses) con la promo: 10 mensualidades. */
  precio_anual_cop: number;
  /** Si sube a este plan en plena vigencia: solo paga la diferencia (el vencimiento no cambia). null = plan completo. */
  precio_cambio_cop: number | null;
  /** false si el tope del plan es menor que sus trabajadores activos. */
  disponible: boolean;
}

export interface Suscripcion {
  activa: boolean;
  plan: PlanEmpresa;
  vigente_hasta: string | null;
  dias_restantes: number | null;
  /** Días que sigue operando la empresa después de vencida (luego se bloquea la gestión). */
  dias_gracia: number;
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
  /** Rubro / a qué se dedica (ej. "Logística y transporte"). Texto libre que carga la empresa. */
  actividad: string | null;
  acepta_postulaciones: boolean;
  /** Cargos activos en la empresa — informativo, la empresa decide cuál asignar al aprobar. */
  cargos: { id: number; nombre: string }[];
  /** Promedio de turnos publicados por semana en las últimas 12 semanas. null si no ha publicado en ese lapso. */
  turnos_promedio_semana: number | null;
  /** Promedio de tarifa_dia ofrecida en esos turnos. null si no ha publicado en ese lapso. */
  pago_promedio: number | null;
  /** Hasta 5 cargos que más ha solicitado recientemente, de más a menos frecuente. */
  cargos_frecuentes: { id: number; nombre: string; veces: number }[];
}

export type TipoLiquidacion = 'mensual' | 'quincenal' | 'semanal';

/** 'laboral' aplica descuentos de ley (salud/pensión) en la liquidación; 'prestacion_servicios' no. */
export type TipoContrato = 'laboral' | 'prestacion_servicios';

/** Vista completa que solo ve el admin_empresa de esa empresa */
export interface Empresa extends EmpresaDirectorio {
  nit: string | null;
  /** Nombre y cédula de quien firma por la empresa — se imprimen en el contrato de cada trabajador. */
  representante_nombre: string | null;
  representante_cedula: string | null;
  /** Firma guardada del representante — SVG de trazos (mobile) o imagen subida (web). Se estampa en todos los contratos. Solo admin_empresa la carga. */
  firma_representante_b64: string | null;
  plan: string;
  tipo_liquidacion: TipoLiquidacion;
  tipo_contrato: TipoContrato;
  /** false = no se suman recargos nocturnos/festivos (solo se acumulan horas y se avisa al pasar 42 h). */
  sumar_nocturnas_festivo: boolean;
  regla_domingo_habitual: 'ley' | 'dos_meses';
  created_at: string;
}

export interface ActualizarMiEmpresaPayload {
  nombre?: string;
  nit?: string;
  representante_nombre?: string;
  representante_cedula?: string;
  firma_representante_b64?: string;
  ciudad?: string;
  descripcion?: string;
  actividad?: string;
  logo_url?: string;
  acepta_postulaciones?: boolean;
  tipo_liquidacion?: TipoLiquidacion;
  tipo_contrato?: TipoContrato;
  sumar_nocturnas_festivo?: boolean;
  regla_domingo_habitual?: 'ley' | 'dos_meses';
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
  generarLinkPago(payload: { meses?: number; plan?: PlanEmpresa } = {}): Promise<{ url: string; referencia: string; plan: PlanEmpresa; monto_cop: number; prorrateado: boolean; expira_at: string }> {
    return api.post('/api/empresas/suscripcion/pagar', payload);
  },

  /** Reclasifica (horas nocturnas/festivo/extra) los días ya registrados del período abierto con la config de recargos actual. */
  reprocesarRecargos(): Promise<{ periodo_id: number; registros_actualizados: number }> {
    return api.post('/api/empresas/reprocesar-recargos');
  },
};
