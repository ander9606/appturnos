import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'sonner';
import { turnosApi } from '../api/turnosApi';
import type { EstadoOferta, EstadoAsignacion } from '../types';

const KEYS = {
  ofertas: (params?: object) => ['turnos', 'ofertas', params] as const,
  oferta: (id: number) => ['turnos', 'oferta', id] as const,
  puestos: (ofertaId: number) => ['turnos', 'puestos', ofertaId] as const,
  asignaciones: (params?: object) => ['turnos', 'asignaciones', params] as const,
};

function getErrMsg(err: unknown) {
  return axios.isAxiosError(err)
    ? (err.response?.data?.message as string | undefined) ?? 'Error'
    : 'Error inesperado';
}

export function useOfertas(params?: { estado?: EstadoOferta; fecha?: string; limit?: number }) {
  return useQuery({
    queryKey: KEYS.ofertas(params),
    queryFn: () => turnosApi.listarOfertas({ ...params, limit: params?.limit ?? 50 }),
    staleTime: 30_000,
  });
}

export function useOferta(id: number | null) {
  return useQuery({
    queryKey: KEYS.oferta(id!),
    queryFn: () => turnosApi.obtenerOferta(id!),
    enabled: id !== null,
    staleTime: 30_000,
  });
}

export function usePuestos(ofertaId: number) {
  return useQuery({
    queryKey: KEYS.puestos(ofertaId),
    queryFn: () => turnosApi.listarPuestos(ofertaId),
    staleTime: 30_000,
  });
}

export function useCrearPuesto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ ofertaId, ...data }: { ofertaId: number; cargo_id: number; plazas?: number; tarifa_dia: number; notas?: string }) =>
      turnosApi.crearPuesto(ofertaId, data),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: KEYS.puestos(vars.ofertaId) });
      qc.invalidateQueries({ queryKey: ['turnos', 'oferta'] });
      toast.success('Puesto agregado');
    },
    onError: (err: unknown) => toast.error(getErrMsg(err)),
  });
}

export function useActualizarPuesto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ ofertaId, puestoId, ...data }: { ofertaId: number; puestoId: number; plazas?: number; tarifa_dia?: number; notas?: string | null }) =>
      turnosApi.actualizarPuesto(ofertaId, puestoId, data),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: KEYS.puestos(vars.ofertaId) });
      qc.invalidateQueries({ queryKey: ['turnos', 'oferta'] });
      toast.success('Puesto actualizado');
    },
    onError: (err: unknown) => toast.error(getErrMsg(err)),
  });
}

export function useEliminarPuesto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ ofertaId, puestoId }: { ofertaId: number; puestoId: number }) =>
      turnosApi.eliminarPuesto(ofertaId, puestoId),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: KEYS.puestos(vars.ofertaId) });
      qc.invalidateQueries({ queryKey: ['turnos', 'oferta'] });
      toast.success('Puesto eliminado');
    },
    onError: (err: unknown) => toast.error(getErrMsg(err)),
  });
}

export function useAsignaciones(params: { oferta_id?: number; estado?: EstadoAsignacion; limit?: number }) {
  return useQuery({
    queryKey: KEYS.asignaciones(params),
    queryFn: () => turnosApi.listarAsignaciones({ ...params, limit: params.limit ?? 200 }),
    enabled: params.oferta_id !== undefined,
    staleTime: 30_000,
  });
}

export function useCrearOferta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => turnosApi.crearOferta(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['turnos', 'ofertas'] });
      toast.success('Oferta creada');
    },
    onError: (err: unknown) => toast.error(getErrMsg(err)),
  });
}

export function usePublicarOferta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => turnosApi.publicarOferta(id),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ['turnos', 'ofertas'] });
      qc.invalidateQueries({ queryKey: KEYS.oferta(id) });
      toast.success('Oferta publicada');
    },
    onError: (err: unknown) => toast.error(getErrMsg(err)),
  });
}

export function useCancelarOferta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => turnosApi.cancelarOferta(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['turnos', 'ofertas'] });
      toast.success('Oferta cancelada');
    },
    onError: (err: unknown) => toast.error(getErrMsg(err)),
  });
}

export function useConfirmarAsignacion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => turnosApi.confirmarAsignacion(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['turnos', 'asignaciones'] });
      toast.success('Asignación confirmada');
    },
    onError: (err: unknown) => toast.error(getErrMsg(err)),
  });
}

export function useRechazarAsignacion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => turnosApi.rechazarAsignacion(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['turnos', 'asignaciones'] });
      toast.success('Asignación rechazada');
    },
    onError: (err: unknown) => toast.error(getErrMsg(err)),
  });
}

export function useCancelarAsignacion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => turnosApi.cancelarAsignacion(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['turnos', 'asignaciones'] });
      toast.success('Asignación cancelada');
    },
    onError: (err: unknown) => toast.error(getErrMsg(err)),
  });
}

export function useNoPresentado() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => turnosApi.noPresentado(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['turnos', 'asignaciones'] });
      toast.success('Marcado como no presentado');
    },
    onError: (err: unknown) => toast.error(getErrMsg(err)),
  });
}

export function useCalificar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: number; calificacion: number; comentario?: string }) =>
      turnosApi.calificar(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['turnos', 'asignaciones'] });
      toast.success('Calificación guardada');
    },
    onError: (err: unknown) => toast.error(getErrMsg(err)),
  });
}
