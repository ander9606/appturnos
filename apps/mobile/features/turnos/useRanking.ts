import { useMutation, useQueryClient } from '@tanstack/react-query';
import { turnosApi } from '@api-client';
import type { Vinculo } from '@api-client';
import { nivelRanking, type NivelRanking } from './rankingUtils';

/**
 * Returns the ranking level for a given company link.
 * Convenient wrapper so screens don't need to import rankingUtils directly.
 */
export function useRankingInfo(vinculo: Pick<Vinculo, 'ranking' | 'total_calificaciones'>) {
  const nivel: NivelRanking = nivelRanking(vinculo.ranking, vinculo.total_calificaciones);
  return { nivel };
}

/**
 * Mutation hook for managers to mark a worker as no-show.
 * Automatically registers 0-star rating and recalculates their ranking.
 */
export function useMarcarNoPresentado() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (asignacionId: number) => turnosApi.marcarNoPresentado(asignacionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['asignaciones'] });
      queryClient.invalidateQueries({ queryKey: ['turnos', 'ofertas'] });
    },
  });
}
