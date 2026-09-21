import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Alert } from 'react-native';
import { nominaApi, ApiError } from '@api-client';
import { t } from '@/lib/i18n';

/** Ej. "No puedes asignar el descanso a un domingo o festivo" o "El trabajador
 * ya tiene otro descanso asignado ese día" — el picker de colores solo oculta
 * esas fechas en el cliente, el servidor es quien decide de verdad (puede
 * cambiar entre que se cargó el rango y que se confirmó, por una carrera con
 * otro gestor). Sin esto, un rechazo del servidor quedaba silencioso. */
function alertarErrorCompensatorio(err: unknown) {
  Alert.alert('Error', err instanceof ApiError ? err.message : t('common.error'));
}

/** Compensatorios propios del trabajador_nomina (pendientes y asignados) — no solo pendientes,
 * o el banner de "descanso ya asignado" nunca tendría datos que mostrar. */
export function useMisCompensatorios() {
  return useQuery({
    queryKey: ['compensatorios', 'propios'],
    queryFn: () => nominaApi.listarCompensatorios(),
    staleTime: 60_000,
  });
}

export function useCompensatoriosTodos() {
  return useQuery({
    queryKey: ['compensatorios'],
    queryFn: () => nominaApi.listarCompensatorios(),
    staleTime: 60_000,
  });
}

export function useAsignarCompensatorio() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, fecha }: { id: number; fecha: string }) =>
      nominaApi.asignarCompensatorio(id, fecha),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['compensatorios'] });
      qc.invalidateQueries({ queryKey: ['registros'] });
    },
    onError: alertarErrorCompensatorio,
  });
}

/** Mueve un descanso ya asignado/tomado a otra fecha. */
export function useReasignarCompensatorio() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, fecha }: { id: number; fecha: string }) =>
      nominaApi.reasignarCompensatorio(id, fecha),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['compensatorios'] });
      // Libera el día anterior (se borra o vuelve 'ordinario') y crea el nuevo —
      // sin esto, Registros del período seguía mostrando el día viejo como
      // 'Compensatorio' hasta un refresh manual.
      qc.invalidateQueries({ queryKey: ['registros'] });
    },
    onError: alertarErrorCompensatorio,
  });
}

/** Los 28 días candidatos para asignar un compensatorio, con su zona de color y disponibilidad. */
export function useRangoCompensatorio(id: number, enabled: boolean) {
  return useQuery({
    queryKey: ['compensatorios', id, 'rango'],
    queryFn: () => nominaApi.rangoCompensatorio(id),
    enabled,
    staleTime: 60_000,
  });
}
