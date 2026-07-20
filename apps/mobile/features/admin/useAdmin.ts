/**
 * Hooks de TanStack Query para el módulo admin (super_admin).
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  adminApi,
  type EmpresasListParams,
  type CrearEmpresaPayload,
  type ActualizarEmpresaPayload,
  type WompiEventosParams,
  type PlanEmpresa,
} from '@api-client';

// ── Query keys ────────────────────────────────────────────────────────────

export const ADMIN_KEYS = {
  reportes: ['admin', 'reportes', 'global'] as const,
  empresas: (params?: EmpresasListParams) => ['admin', 'empresas', params] as const,
  empresa: (id: number) => ['admin', 'empresa', id] as const,
  wompiEventos: (params?: WompiEventosParams) => ['admin', 'wompi-eventos', params] as const,
};

// ── Reportes globales ──────────────────────────────────────────────────────

export function useReportesGlobales(enabled = true) {
  return useQuery({
    queryKey: ADMIN_KEYS.reportes,
    queryFn: () => adminApi.reportesGlobales(),
    staleTime: 30_000, // Refresh más frecuente para el dashboard
    enabled,
  });
}

// ── Empresas ───────────────────────────────────────────────────────────────

export function useAdminEmpresas(params?: EmpresasListParams, enabled = true) {
  return useQuery({
    queryKey: ADMIN_KEYS.empresas(params),
    queryFn: () => adminApi.listarEmpresas(params),
    staleTime: 30_000,
    enabled,
  });
}

export function useAdminEmpresa(id: number, enabled = true) {
  return useQuery({
    queryKey: ADMIN_KEYS.empresa(id),
    queryFn: () => adminApi.obtenerEmpresa(id),
    enabled: id > 0 && enabled,
  });
}

export function useCrearEmpresa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (datos: CrearEmpresaPayload) => adminApi.crearEmpresa(datos),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'empresas'] });
      qc.invalidateQueries({ queryKey: ADMIN_KEYS.reportes });
    },
  });
}

export function useActualizarEmpresa(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (datos: ActualizarEmpresaPayload) => adminApi.actualizarEmpresa(id, datos),
    onSuccess: (empresa) => {
      qc.setQueryData(ADMIN_KEYS.empresa(id), empresa);
      qc.invalidateQueries({ queryKey: ['admin', 'empresas'] });
    },
  });
}

export function useCambiarEstadoEmpresa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, activo }: { id: number; activo: boolean }) =>
      adminApi.cambiarEstadoEmpresa(id, activo),
    onSuccess: (empresa) => {
      qc.setQueryData(ADMIN_KEYS.empresa(empresa.id), empresa);
      qc.invalidateQueries({ queryKey: ['admin', 'empresas'] });
      qc.invalidateQueries({ queryKey: ADMIN_KEYS.reportes });
    },
  });
}

export function useGenerarLinkPago(id: number) {
  return useMutation({
    mutationFn: (datos: { plan: PlanEmpresa; meses?: number }) => adminApi.generarLinkPago(id, datos),
  });
}

// ── Wompi eventos ─────────────────────────────────────────────────────────

export function useWompiEventos(params?: WompiEventosParams, enabled = true) {
  return useQuery({
    queryKey: ADMIN_KEYS.wompiEventos(params),
    queryFn: () => adminApi.listarWompiEventos(params),
    staleTime: 15_000,
    enabled,
  });
}

export function useReintentarWompiEvento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => adminApi.reintentarWompiEvento(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'wompi-eventos'] });
      qc.invalidateQueries({ queryKey: ['admin', 'empresas'] });
      qc.invalidateQueries({ queryKey: ADMIN_KEYS.reportes });
    },
  });
}
