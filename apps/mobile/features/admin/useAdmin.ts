/**
 * Hooks de TanStack Query para el módulo admin (super_admin).
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  adminApi,
  type EmpresasListParams,
  type CrearEmpresaPayload,
  type ActualizarEmpresaPayload,
} from '@api-client';

// ── Query keys ────────────────────────────────────────────────────────────

export const ADMIN_KEYS = {
  reportes: ['admin', 'reportes', 'global'] as const,
  empresas: (params?: EmpresasListParams) => ['admin', 'empresas', params] as const,
  empresa: (id: number) => ['admin', 'empresa', id] as const,
};

// ── Reportes globales ──────────────────────────────────────────────────────

export function useReportesGlobales() {
  return useQuery({
    queryKey: ADMIN_KEYS.reportes,
    queryFn: () => adminApi.reportesGlobales(),
    staleTime: 30_000, // Refresh más frecuente para el dashboard
  });
}

// ── Empresas ───────────────────────────────────────────────────────────────

export function useAdminEmpresas(params?: EmpresasListParams) {
  return useQuery({
    queryKey: ADMIN_KEYS.empresas(params),
    queryFn: () => adminApi.listarEmpresas(params),
    staleTime: 30_000,
  });
}

export function useAdminEmpresa(id: number) {
  return useQuery({
    queryKey: ADMIN_KEYS.empresa(id),
    queryFn: () => adminApi.obtenerEmpresa(id),
    enabled: id > 0,
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
