import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { turnosApi } from '@api-client';

// ── Query keys ────────────────────────────────────────────────────────────

export const QUERY_KEYS = {
  misTurnos: ['misTurnos'] as const,
  ofertas:   (params?: object) => ['ofertas', params] as const,
  oferta:    (id: number) => ['oferta', id] as const,
};

// ── Queries ───────────────────────────────────────────────────────────────

/** Turnos y postulaciones del trabajador autenticado. */
export function useMisTurnos() {
  return useQuery({
    queryKey: QUERY_KEYS.misTurnos,
    queryFn:  () => turnosApi.misTurnos(),
    staleTime: 30_000,
  });
}

/** Lista de ofertas disponibles. */
export function useOfertas(params?: Parameters<typeof turnosApi.listarOfertas>[0]) {
  return useQuery({
    queryKey: QUERY_KEYS.ofertas(params),
    queryFn:  () => turnosApi.listarOfertas(params),
    staleTime: 30_000,
  });
}

/** Detalle de una oferta. */
export function useOferta(id: number | null) {
  return useQuery({
    queryKey: QUERY_KEYS.oferta(id!),
    queryFn:  () => turnosApi.obtenerOferta(id!),
    enabled: id !== null,
  });
}

// ── Mutations ─────────────────────────────────────────────────────────────

/** Postular a una oferta. Invalida misTurnos y la oferta en cuestión. */
export function useAplicar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ofertaId: number) => turnosApi.aplicar(ofertaId),
    onSuccess: (_, ofertaId) => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.misTurnos });
      qc.invalidateQueries({ queryKey: QUERY_KEYS.oferta(ofertaId) });
      qc.invalidateQueries({ queryKey: ['ofertas'] });
    },
  });
}

/** Retirar postulación. */
export function useRetirar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ofertaId: number) => turnosApi.retirar(ofertaId),
    onSuccess: (_, ofertaId) => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.misTurnos });
      qc.invalidateQueries({ queryKey: QUERY_KEYS.oferta(ofertaId) });
      qc.invalidateQueries({ queryKey: ['ofertas'] });
    },
  });
}

/** Marcar ingreso con GPS. */
export function useMarcarIngreso() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, lat, lng }: { id: number; lat: number; lng: number }) =>
      turnosApi.marcarIngreso(id, lat, lng),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.misTurnos });
    },
  });
}

/** Marcar egreso con firma. */
export function useMarcarEgreso() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, firma }: { id: number; firma: string }) =>
      turnosApi.marcarEgreso(id, firma),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.misTurnos });
    },
  });
}
