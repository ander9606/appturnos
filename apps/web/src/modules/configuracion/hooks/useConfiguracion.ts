import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'sonner';
import { configuracionApi } from '../api/configuracionApi';

function getErrMsg(err: unknown) {
  return axios.isAxiosError(err)
    ? (err.response?.data?.message as string | undefined) ?? 'Error'
    : 'Error inesperado';
}

export function useEmpresa() {
  return useQuery({ queryKey: ['config', 'empresa'], queryFn: configuracionApi.getEmpresa, staleTime: 60_000 });
}
export function useUpdateEmpresa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: configuracionApi.updateEmpresa,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['config', 'empresa'] }); toast.success('Empresa actualizada'); },
    onError: (err: unknown) => toast.error(getErrMsg(err)),
  });
}

export function useSuscripcion(enabled = true) {
  return useQuery({ queryKey: ['config', 'suscripcion'], queryFn: configuracionApi.getSuscripcion, staleTime: 60_000, enabled });
}
export function usePagarSuscripcion() {
  return useMutation({
    mutationFn: configuracionApi.pagarSuscripcion,
    onError: (err: unknown) => toast.error(getErrMsg(err)),
  });
}

export function usePuntos() {
  return useQuery({ queryKey: ['config', 'puntos'], queryFn: configuracionApi.getPuntos, staleTime: 60_000 });
}
export function useCreatePunto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: configuracionApi.createPunto,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['config', 'puntos'] }); toast.success('Punto creado'); },
    onError: (err: unknown) => toast.error(getErrMsg(err)),
  });
}
export function useUpdatePunto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: number } & Parameters<typeof configuracionApi.updatePunto>[1]) =>
      configuracionApi.updatePunto(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['config', 'puntos'] }); toast.success('Punto actualizado'); },
    onError: (err: unknown) => toast.error(getErrMsg(err)),
  });
}
export function useDeletePunto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: configuracionApi.deletePunto,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['config', 'puntos'] }); toast.success('Punto eliminado'); },
    onError: (err: unknown) => toast.error(getErrMsg(err)),
  });
}

export function useCargos() {
  return useQuery({ queryKey: ['config', 'cargos'], queryFn: configuracionApi.getCargos, staleTime: 60_000 });
}
export function useCreateCargo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: configuracionApi.createCargo,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['config', 'cargos'] }); toast.success('Cargo creado'); },
    onError: (err: unknown) => toast.error(getErrMsg(err)),
  });
}
export function useUpdateCargo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: number } & Parameters<typeof configuracionApi.updateCargo>[1]) =>
      configuracionApi.updateCargo(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['config', 'cargos'] }); toast.success('Cargo actualizado'); },
    onError: (err: unknown) => toast.error(getErrMsg(err)),
  });
}
export function useDeleteCargo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: configuracionApi.deleteCargo,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['config', 'cargos'] }); toast.success('Cargo eliminado'); },
    onError: (err: unknown) => toast.error(getErrMsg(err)),
  });
}

export function useGestores() {
  return useQuery({ queryKey: ['config', 'gestores'], queryFn: configuracionApi.getGestores, staleTime: 60_000 });
}
export function useCreateGestor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: configuracionApi.createGestor,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['config', 'gestores'] }); toast.success('Gestor creado'); },
    onError: (err: unknown) => toast.error(getErrMsg(err)),
  });
}
export function useToggleGestor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, activo }: { id: number; activo: boolean }) => configuracionApi.toggleGestorActivo(id, activo),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['config', 'gestores'] }); toast.success('Gestor actualizado'); },
    onError: (err: unknown) => toast.error(getErrMsg(err)),
  });
}
