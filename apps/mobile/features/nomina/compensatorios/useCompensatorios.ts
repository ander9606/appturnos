import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { nominaApi } from '@api-client';

export function useCompensatoriosPendientes() {
  return useQuery({
    queryKey: ['compensatorios', 'pendiente'],
    queryFn: () => nominaApi.listarCompensatorios({ estado: 'pendiente' }),
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
