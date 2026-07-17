import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { nominaApi, trabajadoresApi } from '@api-client';
import type { EstadoPeriodo, TipoPeriodo, TipoDia } from '@api-client';

// ── Query keys ────────────────────────────────────────────────────────────

export const NOMINA_KEYS = {
  periodos:     (estado?: EstadoPeriodo) => ['periodos', estado] as const,
  registros:    (params: object)         => ['registros', params] as const,
  liquidacion:  (periodoId: number)      => ['liquidacion', periodoId] as const,
};

// ── Queries ───────────────────────────────────────────────────────────────

export function usePeriodos(estado?: EstadoPeriodo) {
  return useQuery({
    queryKey: NOMINA_KEYS.periodos(estado),
    queryFn:  () => nominaApi.listarPeriodos({ estado, limit: 20 }),
    staleTime: 60_000,
  });
}

export function useRegistros(params: {
  periodo_id?: number;
  trabajador_id?: number;
  fecha?: string;
  limit?: number;
}) {
  return useQuery({
    queryKey: NOMINA_KEYS.registros(params),
    queryFn:  () => nominaApi.listarRegistros({ ...params, limit: params.limit ?? 100 }),
    enabled:  params.periodo_id !== undefined,
    staleTime: 30_000,
  });
}

/** Últimos registros del trabajador autenticado, sin filtrar por período — para el historial de ganancias. */
export function useRegistrosHistorial() {
  return useQuery({
    queryKey: ['registros', 'historial'] as const,
    queryFn:  () => nominaApi.listarRegistros({ limit: 500 }),
    staleTime: 60_000,
  });
}

export function useLiquidacion(periodoId: number | null) {
  return useQuery({
    queryKey: NOMINA_KEYS.liquidacion(periodoId!),
    queryFn:  () => nominaApi.obtenerLiquidacion(periodoId!),
    enabled:  periodoId !== null,
    staleTime: 60_000,
  });
}

// ── Mutations ─────────────────────────────────────────────────────────────

export function useCrearPeriodo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (datos: { fecha_inicio: string; fecha_fin: string; tipo?: TipoPeriodo }) =>
      nominaApi.crearPeriodo(datos),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['periodos'] }),
  });
}

export function useCrearRegistro() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (datos: {
      periodo_id: number;
      fecha: string;
      hora_entrada: string;
      hora_salida?: string;
      trabajador_id?: number;
      novedad?: string;
    }) => nominaApi.crearRegistro(datos),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['registros'] }),
  });
}

export function useCorregirRegistro() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...datos }: { id: number; tipo_dia?: TipoDia; novedad?: string; hora_entrada?: string; hora_salida?: string }) =>
      nominaApi.corregirRegistro(id, datos),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['registros'] }),
  });
}

export function useCerrarPeriodo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (periodoId: number) => nominaApi.cerrarPeriodo(periodoId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['periodos'] });
      qc.invalidateQueries({ queryKey: ['liquidacion'] });
    },
  });
}

export function useLiquidarPeriodo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (periodoId: number) => nominaApi.liquidarPeriodo(periodoId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['periodos'] });
      qc.invalidateQueries({ queryKey: ['liquidacion'] });
    },
  });
}

// ── Marcaje en tiempo real ────────────────────────────────────────────────

export function useNominaPerfil() {
  return useQuery({
    queryKey: ['nomina-perfil'] as const,
    queryFn: () => nominaApi.obtenerMiPerfil(),
    staleTime: 300_000,
  });
}

export function useMarcarEntrada() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (datos?: { latitud?: number; longitud?: number }) =>
      nominaApi.marcarEntrada(datos),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['registros'] });
    },
  });
}

export function useActualizarExtras() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (acepta: boolean) => trabajadoresApi.actualizarExtras(acepta),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['nomina-perfil'] });
    },
  });
}

export function useMarcarSalida() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ registroId, latitud, longitud }: {
      registroId: number;
      latitud?: number;
      longitud?: number;
    }) => nominaApi.marcarSalida(registroId, { latitud, longitud }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['registros'] });
    },
  });
}

export function useSolicitarReingreso() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (motivo?: string) => nominaApi.solicitarReingreso({ motivo }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['registros'] }),
  });
}

export function useReingresosPendientes() {
  return useQuery({
    queryKey: ['reingresos-pendientes'] as const,
    queryFn: () => nominaApi.listarReingresosPendientes(),
    staleTime: 15_000,
    refetchInterval: 15_000,
  });
}

export function useAprobarReingreso() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => nominaApi.aprobarReingreso(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reingresos-pendientes'] }),
  });
}

export function useRechazarReingreso() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => nominaApi.rechazarReingreso(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reingresos-pendientes'] }),
  });
}
