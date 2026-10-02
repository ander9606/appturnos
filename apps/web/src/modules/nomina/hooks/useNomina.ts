import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'sonner';
import { nominaApi } from '../api/nominaApi';
import type { EstadoPeriodo, TipoPeriodo, TipoDia, TipoDescuento } from '../types';

const KEYS = {
  periodos: (estado?: EstadoPeriodo, conTotales?: boolean, fechaDesde?: string, fechaHasta?: string) =>
    ['nomina', 'periodos', estado, conTotales, fechaDesde, fechaHasta] as const,
  registros: (params: object) => ['nomina', 'registros', params] as const,
  liquidacion: (id: number) => ['nomina', 'liquidacion', id] as const,
  trabajadores: () => ['trabajadores', 'nomina'] as const,
  descuentos: (periodoId: number) => ['nomina', 'descuentos', periodoId] as const,
  compensatorios: () => ['nomina', 'compensatorios'] as const,
  rangoCompensatorio: (id: number) => ['nomina', 'compensatorios', id, 'rango'] as const,
  periodoActivoEventual: () => ['nomina', 'eventual', 'periodo-activo'] as const,
  liquidacionEventual: (id: number) => ['nomina', 'eventual', 'liquidacion', id] as const,
};

function getErrMsg(err: unknown) {
  return axios.isAxiosError(err)
    ? (err.response?.data?.message as string | undefined) ?? 'Error'
    : 'Error inesperado';
}

export function usePeriodos(
  estado?: EstadoPeriodo,
  conTotales = false,
  opts: { enabled?: boolean; fechaDesde?: string; fechaHasta?: string } = {},
) {
  return useQuery({
    queryKey: KEYS.periodos(estado, conTotales, opts.fechaDesde, opts.fechaHasta),
    queryFn: () => nominaApi.listarPeriodos({
      estado, conTotales, limit: 50,
      fecha_desde: opts.fechaDesde, fecha_hasta: opts.fechaHasta,
    }),
    staleTime: 60_000,
    enabled: opts.enabled ?? true,
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

/** Período activo del segmento 'nomina' de turnos eventuales (extra) — trimestral. */
export function usePeriodoActivoEventual() {
  return useQuery({
    queryKey: KEYS.periodoActivoEventual(),
    queryFn: () => nominaApi.periodoActivoEventual(),
    staleTime: 60_000,
  });
}

export function useLiquidacionEventual(periodoId: number | null) {
  return useQuery({
    queryKey: KEYS.liquidacionEventual(periodoId!),
    queryFn: () => nominaApi.liquidacionEventual(periodoId!),
    enabled: periodoId !== null,
    staleTime: 60_000,
  });
}

export function useLiquidarEventual() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (periodoId: number) => nominaApi.liquidarEventual(periodoId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['nomina', 'eventual'] });
      toast.success('Período de turnos extra liquidado');
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

function siguienteDia(fecha: string) {
  const d = new Date(`${fecha}T00:00:00`);
  d.setDate(d.getDate() + 1);
  return d.toLocaleDateString('en-CA');
}

/** Crea el mismo tipo_dia (licencia/vacación) para cada día de un rango — un día con registro ya
 * existente (409) se cuenta como "ya existía" en vez de abortar el resto del rango. */
export function useCrearRegistroRango() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (datos: {
      periodo_id: number; trabajador_id: number;
      fecha_desde: string; fecha_hasta: string;
      tipo_dia: TipoDia; novedad?: string;
    }) => {
      let creados = 0, existentes = 0, total = 0;
      for (let fecha = datos.fecha_desde; fecha <= datos.fecha_hasta; fecha = siguienteDia(fecha)) {
        total++;
        try {
          await nominaApi.crearRegistro({
            periodo_id: datos.periodo_id, trabajador_id: datos.trabajador_id,
            fecha, tipo_dia: datos.tipo_dia, novedad: datos.novedad,
          });
          creados++;
        } catch (err) {
          if (axios.isAxiosError(err) && err.response?.status === 409) { existentes++; continue; }
          throw err;
        }
      }
      return { creados, existentes, total };
    },
    onSuccess: ({ creados, existentes, total }) => {
      qc.invalidateQueries({ queryKey: ['nomina', 'registros'] });
      toast.success(
        existentes > 0
          ? `${creados} de ${total} días creados (${existentes} ya tenían registro)`
          : `${creados} día${creados === 1 ? '' : 's'} creado${creados === 1 ? '' : 's'}`
      );
    },
    onError: (err: unknown) => toast.error(getErrMsg(err)),
  });
}

export function useDescuentosPeriodo(periodoId: number | undefined) {
  return useQuery({
    queryKey: KEYS.descuentos(periodoId!),
    queryFn: () => nominaApi.listarDescuentos({ periodo_id: periodoId }),
    enabled: periodoId !== undefined,
    staleTime: 30_000,
  });
}

export function useCrearDescuento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { trabajador_id: number; periodo_id: number; tipo: TipoDescuento; motivo: string; monto: number }) =>
      nominaApi.crearDescuento(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['nomina', 'descuentos'] });
      qc.invalidateQueries({ queryKey: ['nomina', 'liquidacion'] });
      toast.success('Descuento registrado — queda pendiente de aceptación del trabajador');
    },
    onError: (err: unknown) => toast.error(getErrMsg(err)),
  });
}

export function useEliminarDescuento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => nominaApi.eliminarDescuento(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['nomina', 'descuentos'] });
      qc.invalidateQueries({ queryKey: ['nomina', 'liquidacion'] });
      toast.success('Descuento eliminado');
    },
    onError: (err: unknown) => toast.error(getErrMsg(err)),
  });
}

/** Todos los descansos compensatorios de la empresa — para cruzarlos con los registros por trabajador_id + fecha. */
export function useCompensatorios() {
  return useQuery({
    queryKey: KEYS.compensatorios(),
    queryFn: () => nominaApi.listarCompensatorios(),
    staleTime: 30_000,
  });
}

/** Asigna por primera vez la fecha de un descanso compensatorio pendiente. */
export function useAsignarCompensatorio() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, fecha }: { id: number; fecha: string }) =>
      nominaApi.asignarCompensatorio(id, fecha),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.compensatorios() });
      qc.invalidateQueries({ queryKey: ['nomina', 'registros'] });
      qc.invalidateQueries({ queryKey: ['nomina', 'liquidacion'] });
      toast.success('Descanso asignado');
    },
    onError: (err: unknown) => toast.error(getErrMsg(err)),
  });
}

/** Los 28 días candidatos para asignar/reasignar un descanso, con su zona de color y disponibilidad. */
export function useRangoCompensatorio(id: number, enabled: boolean) {
  return useQuery({
    queryKey: KEYS.rangoCompensatorio(id),
    queryFn: () => nominaApi.rangoCompensatorio(id),
    enabled,
    staleTime: 30_000,
  });
}

/** Mueve un descanso compensatorio ya asignado a otra fecha dentro del plazo legal (28 días desde el día festivo/domingo trabajado). */
export function useReasignarCompensatorio() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, fecha }: { id: number; fecha: string }) =>
      nominaApi.reasignarCompensatorio(id, fecha),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.compensatorios() });
      qc.invalidateQueries({ queryKey: ['nomina', 'registros'] });
      qc.invalidateQueries({ queryKey: ['nomina', 'liquidacion'] });
      toast.success('Descanso reasignado');
    },
    onError: (err: unknown) => toast.error(getErrMsg(err)),
  });
}

export function useDescartarSospechoso() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => nominaApi.descartarSospechoso(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['nomina', 'registros'] });
      toast.success('Marcaje ya no está marcado como sospechoso');
    },
    onError: (err: unknown) => toast.error(getErrMsg(err)),
  });
}

export function useCorregirRegistro() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: number; hora_entrada?: string | null; hora_salida?: string | null; novedad?: string; tipo_dia?: TipoDia }) =>
      nominaApi.corregirRegistro(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['nomina', 'registros'] });
      toast.success('Registro actualizado');
    },
    onError: (err: unknown) => toast.error(getErrMsg(err)),
  });
}
