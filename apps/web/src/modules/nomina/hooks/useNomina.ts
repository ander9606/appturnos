import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'sonner';
import { nominaApi } from '../api/nominaApi';
import type { EstadoPeriodo, TipoPeriodo, TipoDia } from '../types';

const KEYS = {
  periodos: (estado?: EstadoPeriodo) => ['nomina', 'periodos', estado] as const,
  registros: (params: object) => ['nomina', 'registros', params] as const,
  liquidacion: (id: number) => ['nomina', 'liquidacion', id] as const,
  trabajadores: () => ['trabajadores', 'nomina'] as const,
};

function getErrMsg(err: unknown) {
  return axios.isAxiosError(err)
    ? (err.response?.data?.message as string | undefined) ?? 'Error'
    : 'Error inesperado';
}

export function usePeriodos(estado?: EstadoPeriodo) {
  return useQuery({
    queryKey: KEYS.periodos(estado),
    queryFn: () => nominaApi.listarPeriodos({ estado, limit: 50 }),
    staleTime: 60_000,
  });
}

export function useRegistros(params: { periodo_id?: number; limit?: number }) {
  return useQuery({
    queryKey: KEYS.registros(params),
    queryFn: () => nominaApi.listarRegistros({ ...params, limit: params.limit ?? 500 }),
    enabled: params.periodo_id !== undefined,
    staleTime: 30_000,
  });
}

export function useLiquidacion(periodoId: number | null) {
  return useQuery({
    queryKey: KEYS.liquidacion(periodoId!),
    queryFn: () => nominaApi.obtenerLiquidacion(periodoId!),
    enabled: periodoId !== null,
    staleTime: 60_000,
  });
}

export function useTrabajadoresNomina() {
  return useQuery({
    queryKey: KEYS.trabajadores(),
    queryFn: () => nominaApi.listarTrabajadores(),
    staleTime: 300_000,
  });
}

export function useCrearPeriodo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { fecha_inicio: string; fecha_fin: string; tipo?: TipoPeriodo }) =>
      nominaApi.crearPeriodo(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['nomina', 'periodos'] });
      toast.success('Período creado');
    },
    onError: (err: unknown) => toast.error(getErrMsg(err)),
  });
}

export function useCerrarPeriodo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => nominaApi.cerrarPeriodo(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['nomina', 'periodos'] });
      qc.invalidateQueries({ queryKey: ['nomina', 'liquidacion'] });
      toast.success('Período cerrado');
    },
    onError: (err: unknown) => toast.error(getErrMsg(err)),
  });
}

export function useLiquidarPeriodo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => nominaApi.liquidarPeriodo(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['nomina', 'periodos'] });
      toast.success('Período liquidado');
    },
    onError: (err: unknown) => toast.error(getErrMsg(err)),
  });
}

export function useCrearRegistro() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: nominaApi.crearRegistro,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['nomina', 'registros'] });
      toast.success('Registro creado');
    },
    onError: (err: unknown) => toast.error(getErrMsg(err)),
  });
}

export function useCorregirRegistro() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: number; hora_entrada?: string; hora_salida?: string; novedad?: string; tipo_dia?: TipoDia }) =>
      nominaApi.corregirRegistro(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['nomina', 'registros'] });
      toast.success('Registro actualizado');
    },
    onError: (err: unknown) => toast.error(getErrMsg(err)),
  });
}
