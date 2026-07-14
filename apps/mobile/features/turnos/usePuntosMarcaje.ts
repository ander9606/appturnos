import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { puntosMarcajeApi } from '@api-client';
import type { CrearPuntoMarcajePayload, ActualizarPuntoMarcajePayload } from '@api-client';

export const PM_KEYS = {
  lista: ['puntos-marcaje'] as const,
};

export function usePuntosMarcaje(enabled = true) {
  return useQuery({
    queryKey: PM_KEYS.lista,
    queryFn:  () => puntosMarcajeApi.listar(),
    staleTime: 5 * 60_000,
    enabled,
  });
}

export function useCrearPuntoMarcaje() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CrearPuntoMarcajePayload) => puntosMarcajeApi.crear(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: PM_KEYS.lista }),
  });
}

export function useActualizarPuntoMarcaje() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: ActualizarPuntoMarcajePayload }) =>
      puntosMarcajeApi.actualizar(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: PM_KEYS.lista }),
  });
}

export function useEliminarPuntoMarcaje() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => puntosMarcajeApi.eliminar(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: PM_KEYS.lista }),
  });
}
