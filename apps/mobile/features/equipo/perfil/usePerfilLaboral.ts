import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { trabajadoresApi } from '@api-client';
import type { UpdateMePayload } from '@api-client';

export const PERFIL_LABORAL_KEY = ['trabajador', 'me'] as const;

export function usePerfilLaboral({ enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: PERFIL_LABORAL_KEY,
    queryFn: () => trabajadoresApi.me(),
    staleTime: 60_000,
    enabled,
  });
}

export function useUpdatePerfilLaboral() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateMePayload) => trabajadoresApi.updateMe(payload),
    onSuccess: (data) => {
      qc.setQueryData(PERFIL_LABORAL_KEY, data);
    },
  });
}
