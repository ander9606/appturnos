import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { turnosEventualApi } from '@api-client';

const QK = {
  periodo: ['turnos-eventual', 'periodo'] as const,
  liquidacion: (id: number) => ['turnos-eventual', 'liquidacion', id] as const,
};

export function usePeriodoEventual() {
  return useQuery({
    queryKey: QK.periodo,
    queryFn:  () => turnosEventualApi.periodoActivo(),
    staleTime: 60_000,
  });
}

export function useLiquidacionEventual(periodoId: number | null) {
  return useQuery({
    queryKey: QK.liquidacion(periodoId!),
    queryFn:  () => turnosEventualApi.liquidacion(periodoId!),
    enabled:  periodoId != null,
    staleTime: 60_000,
  });
}

export function useLiquidarEventual() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (periodoId: number) => turnosEventualApi.liquidar(periodoId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['turnos-eventual'] });
    },
  });
}
