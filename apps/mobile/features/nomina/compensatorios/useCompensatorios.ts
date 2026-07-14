import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { nominaApi } from '@api-client';

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
    },
  });
}
