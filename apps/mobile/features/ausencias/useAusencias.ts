import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ausenciasApi } from '@api-client';
import type { EstadoAusencia, CrearAusenciaPayload } from '@api-client';

const KEY = 'ausencias';

export function useAusencias(params: { estado?: EstadoAusencia } = {}) {
  return useQuery({
    queryKey: [KEY, params],
    queryFn: () => ausenciasApi.listar(params),
    staleTime: 60_000,
  });
}

export function useAusenciasPendientesCount() {
  return useQuery({
    queryKey: [KEY, 'pendientes-count'],
    queryFn: () => ausenciasApi.contarPendientes(),
    staleTime: 60_000,
  });
}

export function useCrearAusencia() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CrearAusenciaPayload) => ausenciasApi.crear(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useActualizarEstadoAusencia() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, estado }: { id: number; estado: 'aprobada' | 'rechazada' }) =>
      ausenciasApi.actualizarEstado(id, estado),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
