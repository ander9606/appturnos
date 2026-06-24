import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { novedadesApi, TipoNovedad } from '@api-client';

export function useNovedades(asignacionId: number | null) {
  return useQuery({
    queryKey: ['novedades', asignacionId],
    queryFn: () => novedadesApi.listar(asignacionId!),
    enabled: asignacionId != null,
    staleTime: 30_000,
  });
}

export function useCrearNovedad(asignacionId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { tipo: TipoNovedad; descripcion: string }) =>
      novedadesApi.crear(asignacionId, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['novedades', asignacionId] }),
  });
}
