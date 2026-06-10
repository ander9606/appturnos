import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { turnosApi, cargosApi } from '@api-client';
import type { LiquidacionTurnosTrabajador, OfertaDetalle, PaginatedResponse, Asignacion, CrearOfertaPayload } from '@api-client';
import { useAuthStore } from '@/features/auth/useAuthStore';

// ── Query keys ────────────────────────────────────────────────────────────

export const QUERY_KEYS = {
  misTurnos:    ['misTurnos'] as const,
  ofertas:      (params?: object) => ['ofertas', params] as const,
  oferta:       (id: number) => ['oferta', id] as const,
  asignacion:   (id: number) => ['asignacion', id] as const,
  asignaciones: (params: object) => ['asignaciones', params] as const,
  liquidacion:  (params?: object) => ['liquidacion-turnos', params] as const,
  cargos:       ['cargos'] as const,
};

// ── Queries ───────────────────────────────────────────────────────────────

/** Turnos y postulaciones del trabajador autenticado. */
export function useMisTurnos(opts: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: QUERY_KEYS.misTurnos,
    queryFn:  () => turnosApi.misTurnos(),
    staleTime: 30_000,
    enabled:  opts.enabled ?? true,
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

/** Todas las asignaciones de la empresa (gestores de turnos). */
export function useAsignacionesGestor() {
  return useQuery({
    queryKey: QUERY_KEYS.asignaciones({ gestor: true }),
    queryFn:  () => turnosApi.listarAsignaciones({ limit: 200 }),
    staleTime: 30_000,
  });
}

/** Postulaciones pendientes de toda la empresa — para el inbox del gestor. */
export function usePostulacionesPendientes(opts: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: QUERY_KEYS.asignaciones({ estado: 'pendiente' }),
    queryFn:  () => turnosApi.listarAsignaciones({ estado: 'pendiente', limit: 200 }),
    staleTime: 15_000,
    refetchOnMount: true,
    enabled:  opts.enabled ?? true,
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

// ── Cache helpers ─────────────────────────────────────────────────────────

function aplicarEstadoEnCache(
  qc: ReturnType<typeof useQueryClient>,
  asignacion: Asignacion,
  ofertaId: number,
) {
  qc.setQueryData<OfertaDetalle>(QUERY_KEYS.oferta(ofertaId), (old) => {
    if (!old) return old;
    return {
      ...old,
      asignaciones: old.asignaciones.map((a) =>
        a.id === asignacion.id ? { ...a, estado: asignacion.estado } : a
      ),
    };
  });
  qc.setQueryData<PaginatedResponse<Asignacion>>(
    QUERY_KEYS.asignaciones({ gestor: true }),
    (old) => {
      if (!old) return old;
      return { ...old, data: old.data.map((a) => a.id === asignacion.id ? { ...a, estado: asignacion.estado } : a) };
    },
  );
  qc.invalidateQueries({ queryKey: QUERY_KEYS.oferta(ofertaId) });
  qc.invalidateQueries({ queryKey: ['ofertas'] });
  qc.invalidateQueries({ queryKey: ['asignaciones'] });
}

// ── Mutations ─────────────────────────────────────────────────────────────

/** Confirmar una postulación pendiente (gestores/admin). */
export function useConfirmar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ asignacionId }: { asignacionId: number; ofertaId: number }) =>
      turnosApi.confirmar(asignacionId),
    onSuccess: (data, { ofertaId }) => aplicarEstadoEnCache(qc, data, ofertaId),
  });
}

/** Postular a una oferta. Invalida misTurnos y la oferta en cuestión. */
export function useAplicar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ ofertaId, puestoId }: { ofertaId: number; puestoId: number }) =>
      turnosApi.aplicar(ofertaId, puestoId),
    onSuccess: (_, { ofertaId }) => {
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
    mutationFn: ({ ofertaId, puestoId }: { ofertaId: number; puestoId: number }) =>
      turnosApi.retirar(ofertaId, puestoId),
    onSuccess: (_, { ofertaId }) => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.misTurnos });
      qc.invalidateQueries({ queryKey: QUERY_KEYS.oferta(ofertaId) });
      qc.invalidateQueries({ queryKey: ['ofertas'] });
    },
  });
}

/** Cancelar una asignación confirmada, devuelve la plaza (gestores/admin). */
export function useCancelar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ asignacionId }: { asignacionId: number; ofertaId: number }) =>
      turnosApi.cancelar(asignacionId),
    onSuccess: (data, { ofertaId }) => aplicarEstadoEnCache(qc, data, ofertaId),
  });
}

/** Rechazar una postulación pendiente (gestores/admin). */
export function useRechazar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ asignacionId }: { asignacionId: number; ofertaId: number }) =>
      turnosApi.rechazar(asignacionId),
    onSuccess: (data, { ofertaId }) => aplicarEstadoEnCache(qc, data, ofertaId),
  });
}

/** Marcar ingreso con GPS. */
export function useMarcarIngreso() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, lat, lng }: { id: number; lat: number; lng: number }) =>
      turnosApi.marcarIngreso(id, lat, lng),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.misTurnos });
      qc.invalidateQueries({ queryKey: QUERY_KEYS.asignacion(id) });
    },
  });
}

/** Marcar egreso con firma. */
export function useMarcarEgreso() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, firma }: { id: number; firma: string }) =>
      turnosApi.marcarEgreso(id, firma),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.misTurnos });
      qc.invalidateQueries({ queryKey: QUERY_KEYS.asignacion(id) });
    },
  });
}

/** Liquidación de turnos por trabajador (gestores/admin). */
export function useLiquidacionTurnos(params?: { fecha_inicio?: string; fecha_fin?: string }) {
  return useQuery<LiquidacionTurnosTrabajador[]>({
    queryKey: QUERY_KEYS.liquidacion(params),
    queryFn:  () => turnosApi.liquidacion(params),
    staleTime: 60_000,
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

/** Marcar no-presentado (jefe/admin) — registra 0 estrellas automático y recalcula ranking. */
export function useNoPresentado() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ asignacionId }: { asignacionId: number; ofertaId: number }) =>
      turnosApi.marcarNoPresentado(asignacionId),
    onSuccess: (data, { ofertaId }) => aplicarEstadoEnCache(qc, data, ofertaId),
  });
}

/** Catálogo de cargos (sistema + custom de la empresa). */
export function useCargos() {
  return useQuery({
    queryKey: QUERY_KEYS.cargos,
    queryFn:  () => cargosApi.listar(),
    staleTime: 5 * 60_000, // cargos cambian poco
  });
}

/** Crea una nueva oferta de turno con sus puestos. */
export function useCrearOferta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CrearOfertaPayload) => turnosApi.crearOferta(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.ofertas() });
    },
  });
}
