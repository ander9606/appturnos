import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { gruposTurnoApi } from '@api-client';
import type { CrearGrupoPayload, EstadoGrupo } from '@api-client';

/** Clave de las consultas de grupos: sirve de prefijo para invalidarlas todas. */
export const GRUPOS_KEY = ['grupos-turno'] as const;

/** Grupos de la empresa (por defecto los activos). `enabled` evita pedirlos hasta que se necesiten. */
export function useGrupos(estado: EstadoGrupo | 'todos' = 'activo', enabled = true) {
  return useQuery({
    queryKey: [...GRUPOS_KEY, estado],
    queryFn: () => gruposTurnoApi.listar(estado),
    enabled,
  });
}

export function useCrearGrupo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CrearGrupoPayload) => gruposTurnoApi.crear(payload),
    onSuccess: () => { qc.invalidateQueries({ queryKey: GRUPOS_KEY }); },
  });
}
