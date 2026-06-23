import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'sonner';
import { adminApi } from '../api/adminApi';
import type { Plan } from '../types';

function getErrMsg(err: unknown) {
  return axios.isAxiosError(err)
    ? (err.response?.data?.message as string | undefined) ?? 'Error'
    : 'Error inesperado';
}

export function useReportesGlobales() {
  return useQuery({
    queryKey: ['admin', 'reportes'],
    queryFn: adminApi.getReportes,
    staleTime: 60_000,
  });
}

export function useEmpresas(params?: { busqueda?: string; plan?: Plan; activo?: boolean; page?: number; limit?: number }) {
  return useQuery({
    queryKey: ['admin', 'empresas', params],
    queryFn: () => adminApi.listarEmpresas({ limit: 50, ...params }),
    staleTime: 30_000,
  });
}

export function useEmpresa(id: number | null) {
  return useQuery({
    queryKey: ['admin', 'empresa', id],
    queryFn: () => adminApi.obtenerEmpresa(id!),
    enabled: id !== null,
    staleTime: 60_000,
  });
}

export function useCrearEmpresa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: adminApi.crearEmpresa,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'empresas'] });
      qc.invalidateQueries({ queryKey: ['admin', 'reportes'] });
      toast.success('Empresa creada');
    },
    onError: (err: unknown) => toast.error(getErrMsg(err)),
  });
}

export function useCambiarEstadoEmpresa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, activo }: { id: number; activo: boolean }) => adminApi.cambiarEstado(id, activo),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'empresas'] });
      qc.invalidateQueries({ queryKey: ['admin', 'reportes'] });
      toast.success('Estado actualizado');
    },
    onError: (err: unknown) => toast.error(getErrMsg(err)),
  });
}
