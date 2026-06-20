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
  opts: { tipo?: TipoTrabajador; activo?: boolean; enabled?: boolean } = {},
) {
  const { enabled = true, ...listOpts } = opts;
  return useQuery({
    queryKey: EQUIPO_KEYS.lista(listOpts.tipo, listOpts.activo),
    queryFn: () =>
      trabajadoresApi.listar({
        tipo: listOpts.tipo,
        activo: listOpts.activo,
        limit: 100,
      }),
    staleTime: 60_000,
    enabled,
  });
}

export function useTrabajador(id: number) {
  return useQuery({
    queryKey: EQUIPO_KEYS.detalle(id),
    queryFn: () => trabajadoresApi.obtener(id),
    staleTime: 60_000,
  });
}

/** Busca un trabajador marketplace por cédula. Devuelve null si no existe. */
export function useBuscarPorCedula(cedula: string) {
  return useQuery({
    queryKey: ['trabajadores', 'buscar', cedula],
    queryFn: () => trabajadoresApi.buscarPorCedula(cedula),
    enabled: cedula.trim().length >= 5,
    staleTime: 30_000,
    retry: false,
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

export function useActualizarMarcacion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, tipo_marcacion, punto_marcaje_id }: {
      id: number;
      tipo_marcacion: 'libre' | 'fijo';
      punto_marcaje_id?: number | null;
    }) => trabajadoresApi.actualizarMarcacion(id, { tipo_marcacion, punto_marcaje_id }),
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
