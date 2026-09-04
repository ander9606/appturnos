import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { nominaApi } from '@api-client';

export function useRegistroDetalle(registroId: number | null) {
  return useQuery({
    queryKey: ['registros', 'detalle', registroId],
    queryFn: async () => {
      if (!registroId) return null;
      return nominaApi.obtenerRegistro(registroId);
    },
    enabled: registroId !== null,
    staleTime: 1 * 60_000,
  });
}

export function useCorregirRegistro() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      registroId: number;
      horaEntrada: string | null;
      horaSalida: string | null;
    }) => {
      return nominaApi.corregirRegistro(data.registroId, {
        hora_entrada: data.horaEntrada || undefined,
        hora_salida: data.horaSalida || undefined,
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['registros', 'detalle', variables.registroId],
      });
      queryClient.invalidateQueries({
        queryKey: ['registros'],
      });
    },
  });
}
