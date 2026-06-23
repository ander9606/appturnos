import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'sonner';
import { integracionApi } from '../api/integracionApi';

function getErrMsg(err: unknown) {
  return axios.isAxiosError(err)
    ? (err.response?.data?.message as string | undefined) ?? 'Error'
    : 'Error inesperado';
}

export function useEstadoIntegracion() {
  return useQuery({
    queryKey: ['integracion', 'estado'],
    queryFn: integracionApi.getEstado,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

export function useConfigIntegracion() {
  return useQuery({
    queryKey: ['integracion', 'config'],
    queryFn: integracionApi.getConfig,
    staleTime: 60_000,
  });
}

export function useUpdateConfigIntegracion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: integracionApi.updateConfig,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['integracion'] });
      toast.success('Configuración actualizada');
    },
    onError: (err: unknown) => toast.error(getErrMsg(err)),
  });
}

export function useEmparejar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (codigo: string) => integracionApi.emparejar(codigo),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['integracion'] });
      toast.success('Conectado con logiq360');
    },
    onError: (err: unknown) => toast.error(getErrMsg(err)),
  });
}

export function useConciliacion() {
  return useQuery({
    queryKey: ['integracion', 'conciliacion'],
    queryFn: integracionApi.getConciliacion,
    staleTime: 60_000,
  });
}

export function useVincular() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ trabajador_id, empleado_id }: { trabajador_id: number; empleado_id: number }) =>
      integracionApi.vincular(trabajador_id, empleado_id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['integracion', 'conciliacion'] });
      toast.success('Trabajador vinculado');
    },
    onError: (err: unknown) => toast.error(getErrMsg(err)),
  });
}
