import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { nominaApi, trabajadoresApi, ApiError } from '@api-client';
import type { EstadoPeriodo, TipoPeriodo, TipoDia } from '@api-client';
import { getDeviceId } from '@/lib/deviceId';

// ── Query keys ────────────────────────────────────────────────────────────

export const NOMINA_KEYS = {
  periodos:     (estado?: EstadoPeriodo, fechaDesde?: string, fechaHasta?: string) =>
    ['periodos', estado, fechaDesde, fechaHasta] as const,
  registros:    (params: object)         => ['registros', params] as const,
  liquidacion:  (periodoId: number)      => ['liquidacion', periodoId] as const,
};

// ── Queries ───────────────────────────────────────────────────────────────

export function usePeriodos(
  estado?: EstadoPeriodo,
  enabled = true,
  opts: { fechaDesde?: string; fechaHasta?: string } = {},
) {
  return useQuery({
    queryKey: NOMINA_KEYS.periodos(estado, opts.fechaDesde, opts.fechaHasta),
    queryFn:  () => nominaApi.listarPeriodos({
      estado, limit: 20,
      fecha_desde: opts.fechaDesde, fecha_hasta: opts.fechaHasta,
    }),
    staleTime: 60_000,
    enabled,
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

/** Últimos registros del trabajador autenticado, sin filtrar por período — para el historial de
 *  ganancias y para el calendario mensual (que sí acota por fecha_desde/fecha_hasta). */
export function useRegistrosHistorial(opts: { enabled?: boolean; fechaDesde?: string; fechaHasta?: string } = {}) {
  return useQuery({
    queryKey: ['registros', 'historial', opts.fechaDesde, opts.fechaHasta] as const,
    queryFn:  () => nominaApi.listarRegistros({
      limit: 500,
      fecha_desde: opts.fechaDesde,
      fecha_hasta: opts.fechaHasta,
    }),
    staleTime: 60_000,
    enabled: opts.enabled ?? true,
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
      hora_entrada?: string;
      hora_salida?: string;
      trabajador_id?: number;
      novedad?: string;
      tipo_dia?: TipoDia;
    }) => nominaApi.crearRegistro(datos),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['registros'] }),
  });
}

function siguienteDia(fecha: string) {
  const d = new Date(`${fecha}T00:00:00`);
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

/** Crea el mismo tipo_dia (licencia/vacación) para cada día de un rango — un día con registro ya
 * existente (409) se cuenta como "ya existía" en vez de abortar el resto del rango. */
export function useCrearRegistroRango() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (datos: {
      periodo_id: number; trabajador_id: number;
      fecha_desde: string; fecha_hasta: string;
      tipo_dia: TipoDia; novedad?: string;
    }) => {
      let creados = 0, existentes = 0, total = 0;
      for (let fecha = datos.fecha_desde; fecha <= datos.fecha_hasta; fecha = siguienteDia(fecha)) {
        total++;
        try {
          await nominaApi.crearRegistro({
            periodo_id: datos.periodo_id, trabajador_id: datos.trabajador_id,
            fecha, tipo_dia: datos.tipo_dia, novedad: datos.novedad,
          });
          creados++;
        } catch (err) {
          if (err instanceof ApiError && err.status === 409) { existentes++; continue; }
          throw err;
        }
      }
      return { creados, existentes, total };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['registros'] }),
  });
}

export function useCorregirRegistro() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...datos }: { id: number; tipo_dia?: TipoDia; novedad?: string; hora_entrada?: string | null; hora_salida?: string | null }) =>
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

export function useNominaPerfil(enabled = true) {
  return useQuery({
    queryKey: ['nomina-perfil'] as const,
    queryFn: () => nominaApi.obtenerMiPerfil(),
    staleTime: 300_000,
    enabled,
  });
}

export function useMarcarEntrada() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (datos?: { latitud?: number; longitud?: number }) =>
      nominaApi.marcarEntrada({ ...datos, device_id: await getDeviceId() }),
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
      // Activar el flag desbloquea listas/detalles de ofertas que antes daban 403 —
      // sin esto quedarían con el error viejo en caché hasta un pull-to-refresh manual.
      qc.invalidateQueries({ queryKey: ['ofertas'] });
      qc.invalidateQueries({ queryKey: ['oferta'] });
    },
  });
}

export function useMarcarSalida() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ registroId, latitud, longitud, jornada_continua }: {
      registroId: number;
      latitud?: number;
      longitud?: number;
      jornada_continua?: boolean;
    }) => nominaApi.marcarSalida(registroId, { latitud, longitud, jornada_continua, device_id: await getDeviceId() }),
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

export function useReingresosPendientes(enabled = true) {
  return useQuery({
    queryKey: ['reingresos-pendientes'] as const,
    queryFn: () => nominaApi.listarReingresosPendientes(),
    enabled,
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
