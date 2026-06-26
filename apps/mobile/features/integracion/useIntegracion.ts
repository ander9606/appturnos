import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { integracionApi } from '@api-client';
import type { ActualizarIntegracionPayload } from '@api-client';

export const INTEGRACION_KEYS = {
  config: ['integracion', 'config'] as const,
  estado: ['integracion', 'estado'] as const,
  conciliacion: ['integracion', 'conciliacion'] as const,
};

export function useIntegracionConfig() {
  return useQuery({
    queryKey: INTEGRACION_KEYS.config,
    queryFn: () => integracionApi.obtenerConfig(),
    staleTime: 30_000,
  });
}

export function useEstadoIntegracion() {
  return useQuery({
    queryKey: INTEGRACION_KEYS.estado,
    queryFn: () => integracionApi.obtenerEstado(),
    staleTime: 30_000,
    refetchInterval: 30_000,
  });
}

export function useActualizarIntegracion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: ActualizarIntegracionPayload) =>
      integracionApi.actualizarConfig(payload),
    onSuccess: (data) => {
      qc.setQueryData(INTEGRACION_KEYS.config, data);
    },
  });
}

export function useEmparejar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (codigo: string) => integracionApi.emparejar(codigo),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: INTEGRACION_KEYS.config });
      qc.invalidateQueries({ queryKey: INTEGRACION_KEYS.estado });
    },
  });
}

export function useConciliacion() {
  return useQuery({
    queryKey: INTEGRACION_KEYS.conciliacion,
    queryFn: () => integracionApi.conciliacion(),
    staleTime: 30_000,
  });
}

export function useVincularEmpleado() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ trabajadorId, empleadoId }: { trabajadorId: number; empleadoId: number }) =>
      integracionApi.vincularEmpleado(trabajadorId, empleadoId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: INTEGRACION_KEYS.conciliacion });
    },
  });
}

export function useReintentarFallidos() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => integracionApi.reintentarFallidos(),
    onSuccess: () => qc.invalidateQueries({ queryKey: INTEGRACION_KEYS.estado }),
  });
}

/** Genera un secret hex de 64 caracteres para usar como webhook key. */
export function generarSecret(): string {
  return Array.from(
    { length: 32 },
    () => Math.floor(Math.random() * 256).toString(16).padStart(2, '0'),
  ).join('');
}
