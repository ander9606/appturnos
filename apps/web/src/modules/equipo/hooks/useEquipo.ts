import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'sonner';
import { equipoApi } from '../api/equipoApi';
import type { TipoTrabajador } from '../types';

const KEYS = {
  lista: (params?: object) => ['trabajadores', params] as const,
  detalle: (id: number) => ['trabajadores', id] as const,
};

function getErrMsg(err: unknown) {
  return axios.isAxiosError(err)
    ? (err.response?.data?.message as string | undefined) ?? 'Error'
    : 'Error inesperado';
}

export function useTrabajadores(params?: { tipo?: TipoTrabajador; activo?: boolean; limit?: number }) {
  return useQuery({
    queryKey: KEYS.lista(params),
    queryFn: () => equipoApi.listar({ ...params, limit: params?.limit ?? 100 }),
    staleTime: 60_000,
  });
}

export function useTrabajador(id: number | null) {
  return useQuery({
    queryKey: KEYS.detalle(id!),
    queryFn: () => equipoApi.obtener(id!),
    enabled: id !== null,
    staleTime: 60_000,
  });
}

export function useCrearTrabajador() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => equipoApi.crear(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['trabajadores'] });
      toast.success('Trabajador creado');
    },
    onError: (err: unknown) => toast.error(getErrMsg(err)),
  });
}

export function useActualizarTrabajador() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: number } & Record<string, unknown>) =>
      equipoApi.actualizar(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['trabajadores'] });
      toast.success('Trabajador actualizado');
    },
    onError: (err: unknown) => toast.error(getErrMsg(err)),
  });
}

export function useDesactivarTrabajador() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => equipoApi.desactivar(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['trabajadores'] });
      toast.success('Trabajador desactivado');
    },
    onError: (err: unknown) => toast.error(getErrMsg(err)),
  });
}
