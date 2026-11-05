import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { gruposApi } from '../api/gruposApi';
import type { EstadoGrupo } from '../types';

/** Clave de las consultas de grupos: sirve de prefijo para invalidarlas todas. */
export const GRUPOS_KEY = ['grupos-turno'] as const;

/** Grupos de la empresa (por defecto los activos). `enabled` evita pedirlos hasta que se necesiten. */
export function useGrupos(estado: EstadoGrupo | 'todos' = 'activo', enabled = true) {
  return useQuery({
    queryKey: [...GRUPOS_KEY, estado],
    queryFn: () => gruposApi.listar(estado),
    enabled,
  });
}

/** Sin toast propio: quien lo usa maneja el 409 de nombre repetido ("Usar ese") y los demás errores. */
export function useCrearGrupo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: gruposApi.crear,
    onSuccess: () => { qc.invalidateQueries({ queryKey: GRUPOS_KEY }); },
  });
}
