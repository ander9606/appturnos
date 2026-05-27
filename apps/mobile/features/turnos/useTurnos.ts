import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { turnosApi } from '@api-client';
import { useAuthStore } from '@/features/auth/useAuthStore';

// ── Query keys ────────────────────────────────────────────────────────────

export const QUERY_KEYS = {
  misTurnos:   ['misTurnos'] as const,
  ofertas:     (params?: object) => ['ofertas', params] as const,
  oferta:      (id: number) => ['oferta', id] as const,
  asignacion:  (id: number) => ['asignacion', id] as const,
  asignaciones:(params: object) => ['asignaciones', params] as const,
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

/**
 * Obtiene una asignación concreta.
 * - Trabajadores: busca en el caché de misTurnos (sin fetch extra).
 * - Gestores/Admin: llama al endpoint GET /asignaciones/:id directamente.
 */
export function useAsignacion(id: number | null) {
  const rol = useAuthStore((s) => s.usuario?.rol);
  const isWorker = rol === 'trabajador_turnos' || rol === 'trabajador_nomina';

  // Vista trabajador — reutiliza el caché de misTurnos
  const workerQuery = useQuery({
    queryKey: QUERY_KEYS.misTurnos,
    queryFn:  () => turnosApi.misTurnos(),
    select:   (data) => data.find((a) => a.id === id) ?? null,
    staleTime: 30_000,
    enabled: id !== null && isWorker,
  });

  // Vista gestor — fetches individualmente con datos de trabajador y calificación
  const gestorQuery = useQuery({
    queryKey: QUERY_KEYS.asignacion(id!),
    queryFn:  () => turnosApi.obtenerAsignacion(id!),
    staleTime: 30_000,
    enabled: id !== null && !isWorker,
  });

  return isWorker ? workerQuery : gestorQuery;
}

/** Asignaciones de un trabajador concreto (gestores/admin). */
export function useAsignacionesTrabajador(
  trabajadorId: number | null,
  params?: { limit?: number },
) {
  return useQuery({
    queryKey: QUERY_KEYS.asignaciones({ trabajadorId, ...params }),
    queryFn:  () =>
      turnosApi.listarAsignaciones({
        trabajador_id: trabajadorId!,
        limit: params?.limit ?? 20,
      }),
    enabled:  trabajadorId !== null,
    staleTime: 60_000,
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

/**
 * Calificar una asignación completada (gestores/admin).
 * Invalida el detalle de la asignación y el perfil del trabajador (ranking).
 */
export function useCalificar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      calificacion,
      comentario,
    }: {
      id: number;
      calificacion: number;
      comentario?: string;
    }) => turnosApi.calificar(id, calificacion, comentario),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.asignacion(id) });
      qc.invalidateQueries({ queryKey: ['asignaciones'] });
      qc.invalidateQueries({ queryKey: QUERY_KEYS.misTurnos });
      qc.invalidateQueries({ queryKey: ['trabajadores'] }); // ranking update
    },
  });
}
