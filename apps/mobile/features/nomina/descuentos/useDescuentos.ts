import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { nominaApi } from '@api-client';
import type { EstadoDescuento, TipoDescuento } from '@api-client';

/** Gestor: descuentos de un período (para crearlos / revisarlos junto a la liquidación). */
export function useDescuentosPeriodo(periodoId: number | undefined) {
  return useQuery({
    queryKey: ['descuentos', periodoId],
    queryFn: () => nominaApi.listarDescuentos({ periodo_id: periodoId }),
    enabled: periodoId !== undefined,
    staleTime: 30_000,
  });
}

/** Trabajador: los suyos (el backend ya los filtra a su propio trabajador_id). */
export function useMisDescuentos(periodoId: number | undefined) {
  return useQuery({
    queryKey: ['descuentos', 'propios', periodoId],
    queryFn: () => nominaApi.listarDescuentos({ periodo_id: periodoId }),
    enabled: periodoId !== undefined,
    staleTime: 30_000,
  });
}

export function useCrearDescuento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (datos: { trabajador_id: number; periodo_id: number; tipo: TipoDescuento; motivo: string; monto: number }) =>
      nominaApi.crearDescuento(datos),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['descuentos'] });
      qc.invalidateQueries({ queryKey: ['liquidacion'] });
    },
  });
}

function useResponderDescuento(estado: EstadoDescuento) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      estado === 'aceptado' ? nominaApi.aceptarDescuento(id) : nominaApi.rechazarDescuento(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['descuentos'] });
      qc.invalidateQueries({ queryKey: ['liquidacion'] });
    },
  });
}

export const useAceptarDescuento  = () => useResponderDescuento('aceptado');
export const useRechazarDescuento = () => useResponderDescuento('rechazado');

export function useEliminarDescuento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => nominaApi.eliminarDescuento(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['descuentos'] });
      qc.invalidateQueries({ queryKey: ['liquidacion'] });
    },
  });
}
