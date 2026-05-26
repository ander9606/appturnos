import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { nominaApi } from '@api-client';
import type { EstadoPeriodo } from '@api-client';

// ── Query keys ────────────────────────────────────────────────────────────

export const NOMINA_KEYS = {
  periodos:     (estado?: EstadoPeriodo) => ['periodos', estado] as const,
  registros:    (params: object)         => ['registros', params] as const,
  liquidacion:  (periodoId: number)      => ['liquidacion', periodoId] as const,
};

// ── Queries ───────────────────────────────────────────────────────────────

export function usePeriodos(estado?: EstadoPeriodo) {
  return useQuery({
    queryKey: NOMINA_KEYS.periodos(estado),
    queryFn:  () => nominaApi.listarPeriodos({ estado, limit: 20 }),
    staleTime: 60_000,
  });
}

export function useRegistros(params: {
  periodo_id?: number;
  trabajador_id?: number;
  limit?: number;
}) {
  return useQuery({
    queryKey: NOMINA_KEYS.registros(params),
    queryFn:  () => nominaApi.listarRegistros({ ...params, limit: params.limit ?? 100 }),
    enabled:  params.periodo_id !== undefined,
    staleTime: 30_000,
  });
}

export function useLiquidacion(periodoId: number | null) {
  return useQuery({
    queryKey: NOMINA_KEYS.liquidacion(periodoId!),
    queryFn:  () => nominaApi.obtenerLiquidacion(periodoId!),
    enabled:  periodoId !== null,
    staleTime: 60_000,
  });
}

// ── Mutations ─────────────────────────────────────────────────────────────

export function useCerrarPeriodo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (periodoId: number) => nominaApi.cerrarPeriodo(periodoId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['periodos'] });
      qc.invalidateQueries({ queryKey: ['liquidacion'] });
    },
  });
}

export function useLiquidarPeriodo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (periodoId: number) => nominaApi.liquidarPeriodo(periodoId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['periodos'] });
      qc.invalidateQueries({ queryKey: ['liquidacion'] });
    },
  });
}
