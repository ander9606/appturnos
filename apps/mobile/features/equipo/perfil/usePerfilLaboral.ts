import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { trabajadoresApi } from '@api-client';
import type { UpdateMePayload, ExperienciaPayload, DiplomaPayload } from '@api-client';

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
    onSuccess: (data) => { qc.setQueryData(PERFIL_LABORAL_KEY, data); },
  });
}

export function useCrearExperiencia() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: ExperienciaPayload) => trabajadoresApi.crearExperiencia(payload),
    onSuccess: () => { qc.invalidateQueries({ queryKey: PERFIL_LABORAL_KEY }); },
  });
}

export function useEliminarExperiencia() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (expId: number) => trabajadoresApi.eliminarExperiencia(expId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: PERFIL_LABORAL_KEY }); },
  });
}

export function useCrearDiploma() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: DiplomaPayload) => trabajadoresApi.crearDiploma(payload),
    onSuccess: () => { qc.invalidateQueries({ queryKey: PERFIL_LABORAL_KEY }); },
  });
}

export function useEliminarDiploma() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dipId: number) => trabajadoresApi.eliminarDiploma(dipId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: PERFIL_LABORAL_KEY }); },
  });
}
