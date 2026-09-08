import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { contratosApi, type Contrato } from '@api-client';

// ── Query keys ────────────────────────────────────────────────────────────

export const QUERY_KEYS = {
  contrato: (asignacionId: number) => ['contrato', asignacionId] as const,
  sinFirmar: () => ['contratos', 'sin-firmar'] as const,
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
      // Invalida la asignación (vista gestor) y misTurnos (vista trabajador:
      // turno individual vía useAsignacion + resumen de nómina/quincena, que
      // se calculan a partir de contrato_firmado en esa misma cache).
      qc.invalidateQueries({ queryKey: ['asignacion', data.asignacion_id] });
      qc.invalidateQueries({ queryKey: ['misTurnos'] });
    },
  });
}
