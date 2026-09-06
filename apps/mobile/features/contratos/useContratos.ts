import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { contratosApi, type Contrato } from '@api-client';

// ── Query keys ────────────────────────────────────────────────────────────

export const QUERY_KEYS = {
  contrato: (asignacionId: number) => ['contrato', asignacionId] as const,
};

// ── Queries ───────────────────────────────────────────────────────────────

/** Obtiene el contrato de una asignación. */
export function useObtenerContrato(asignacionId: number | null) {
  return useQuery({
    queryKey: asignacionId ? QUERY_KEYS.contrato(asignacionId) : ['contrato', null],
    queryFn:  () => contratosApi.obtenerPorAsignacion(asignacionId!),
    enabled:  asignacionId !== null,
    staleTime: 60_000,
    retry: 1,
    throwOnError: false,
  });
}

// ── Mutations ─────────────────────────────────────────────────────────────

/** Firma un contrato con una firma digital. */
export function useFirmarContrato() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ contratoId, firma_b64 }: { contratoId: number; firma_b64: string }) =>
      contratosApi.firmar(contratoId, firma_b64),
    onSuccess: (data: Contrato) => {
      qc.setQueryData(QUERY_KEYS.contrato(data.asignacion_id), data);
      // Invalida la asignación para refrescar su estado de contrato
      qc.invalidateQueries({ queryKey: ['asignacion', data.asignacion_id] });
    },
  });
}
