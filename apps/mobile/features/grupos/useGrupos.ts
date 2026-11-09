import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { gruposTurnoApi } from '@api-client';
import type { ActualizarGrupoPayload, CrearGrupoPayload, EstadoGrupo } from '@api-client';

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

/** Un grupo con sus turnos (pantalla de detalle). */
export function useGrupo(id: number) {
  return useQuery({
    queryKey: [...GRUPOS_KEY, 'detalle', id],
    queryFn: () => gruposTurnoApi.obtener(id),
    enabled: Number.isFinite(id),
  });
}

/** Costos del grupo (lo pagado, lo comprometido y lo frenado). Cuelga de GRUPOS_KEY: cambiar turnos o cerrar lo refresca. */
export function useCostosGrupo(id: number, enabled = true) {
  return useQuery({
    queryKey: [...GRUPOS_KEY, 'costos', id],
    queryFn: () => gruposTurnoApi.costos(id),
    enabled: enabled && Number.isFinite(id),
  });
}

/** Cerrar o reabrir un grupo; refresca listas y detalle (todos cuelgan de GRUPOS_KEY). */
export function useCambiarEstadoGrupo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, cerrar, confirmar }: { id: number; cerrar: boolean; confirmar?: boolean }) =>
      cerrar ? gruposTurnoApi.cerrar(id, { confirmar }) : gruposTurnoApi.reabrir(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: GRUPOS_KEY }); },
  });
}

export function useCrearGrupo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CrearGrupoPayload) => gruposTurnoApi.crear(payload),
    onSuccess: () => { qc.invalidateQueries({ queryKey: GRUPOS_KEY }); },
  });
}

/** Guardar los cambios de un grupo (nombre, descripción, lugar). Refresca la lista y el detalle (cuelgan de GRUPOS_KEY). */
export function useActualizarGrupo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: ActualizarGrupoPayload }) => gruposTurnoApi.actualizar(id, payload),
    onSuccess: () => { qc.invalidateQueries({ queryKey: GRUPOS_KEY }); },
  });
}
