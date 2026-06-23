import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notificacionesApi } from '@api-client';

const KEYS = {
  list:     ['notificaciones'] as const,
  noLeidas: ['notificaciones-no-leidas'] as const,
};

export function useNotificaciones(page = 1, limit = 30) {
  return useQuery({
    queryKey:  [...KEYS.list, page, limit],
    queryFn:   () => notificacionesApi.listar({ page, limit }),
    staleTime: 30_000,
  });
}

/** Devuelve solo el conteo de no leídas — para el badge de la campana. */
export function useCountNoLeidas(): number {
  const { data } = useQuery({
    queryKey:  KEYS.noLeidas,
    queryFn:   () => notificacionesApi.listar({ no_leidas: true, limit: 1 }),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
  return data?.no_leidas ?? 0;
}

export function useMarcarLeida() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => notificacionesApi.marcarLeida(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.list });
      qc.invalidateQueries({ queryKey: KEYS.noLeidas });
    },
  });
}

export function useMarcarTodasLeidas() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => notificacionesApi.marcarTodasLeidas(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.list });
      qc.invalidateQueries({ queryKey: KEYS.noLeidas });
    },
  });
}
