import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'sonner';
import { gruposApi } from '../api/gruposApi';
import { avisoDeCierre } from '../grupoUtils';
import type { ActualizarGrupoPayload, EstadoGrupo } from '../types';

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

/** Un grupo con sus turnos (página de detalle). */
export function useGrupo(id: number | null) {
  return useQuery({
    queryKey: [...GRUPOS_KEY, 'detalle', id],
    queryFn: () => gruposApi.obtener(id!),
    enabled: id !== null && Number.isFinite(id),
  });
}

/** Cerrar o reabrir; el 409 del servidor ("tiene turnos sin terminar…") sale tal cual como aviso. */
export function useCambiarEstadoGrupo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, cerrar, confirmar }: { id: number; cerrar: boolean; confirmar?: boolean }) =>
      (cerrar ? gruposApi.cerrar(id, confirmar) : gruposApi.reabrir(id)),
    onSuccess: (_d, { cerrar }) => {
      qc.invalidateQueries({ queryKey: GRUPOS_KEY });
      toast.success(cerrar ? 'Grupo cerrado' : 'Grupo reabierto');
    },
    onError: (err) => {
      if (avisoDeCierre(err)) return; // no es un fallo: la página pregunta si cerrar de todos modos
      toast.error(axios.isAxiosError(err) ? (err.response?.data?.message as string | undefined) ?? 'No se pudo completar.' : 'No se pudo completar.');
    },
  });
}

/** Guardar los cambios de un grupo. Sin toast de error propio: el formulario maneja el 409 de nombre repetido. */
export function useActualizarGrupo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: ActualizarGrupoPayload }) => gruposApi.actualizar(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: GRUPOS_KEY }); toast.success('Cambios guardados'); },
  });
}
