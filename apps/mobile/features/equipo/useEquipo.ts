import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { trabajadoresApi } from '@api-client';
import type { TipoTrabajador, CrearTrabajadorPayload, ActualizarTrabajadorPayload } from '@api-client';

// ── Query keys ────────────────────────────────────────────────────────────

export const EQUIPO_KEYS = {
  lista: (tipo?: TipoTrabajador, activo?: boolean) =>
    ['trabajadores', tipo, activo] as const,
  detalle: (id: number) => ['trabajadores', id] as const,
};

// ── Queries ───────────────────────────────────────────────────────────────

export function useTrabajadores(
  opts: { tipo?: TipoTrabajador; activo?: boolean } = {},
) {
  return useQuery({
    queryKey: EQUIPO_KEYS.lista(opts.tipo, opts.activo),
    queryFn: () =>
      trabajadoresApi.listar({
        tipo: opts.tipo,
        activo: opts.activo,
        limit: 100,
      }),
    staleTime: 60_000,
  });
}

export function useTrabajador(id: number) {
  return useQuery({
    queryKey: EQUIPO_KEYS.detalle(id),
    queryFn: () => trabajadoresApi.obtener(id),
    staleTime: 60_000,
  });
}

// ── Mutations ─────────────────────────────────────────────────────────────

export function useCrearTrabajador() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CrearTrabajadorPayload) => trabajadoresApi.crear(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['trabajadores'] }),
  });
}

export function useActualizarTrabajador(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: ActualizarTrabajadorPayload) =>
      trabajadoresApi.actualizar(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['trabajadores'] }),
  });
}

export function useDesactivarTrabajador() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => trabajadoresApi.desactivar(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['trabajadores'] }),
  });
}
