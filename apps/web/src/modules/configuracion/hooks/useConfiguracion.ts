import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'sonner';
import { useAuthStore } from '@/modules/auth/authStore';
import { configuracionApi } from '../api/configuracionApi';

function getErrMsg(err: unknown) {
  return axios.isAxiosError(err)
    ? (err.response?.data?.message as string | undefined) ?? 'Error'
    : 'Error inesperado';
}

export function useEmpresa(enabled = true) {
  return useQuery({ queryKey: ['config', 'empresa'], queryFn: configuracionApi.getEmpresa, staleTime: 60_000, enabled });
}
export function useUpdateEmpresa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: configuracionApi.updateEmpresa,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['config', 'empresa'] });
      // El admin pudo encender/apagar los grupos o cambiar cómo los llama: que se vea de inmediato.
      qc.invalidateQueries({ queryKey: ['opciones-grupos'] });
      toast.success('Empresa actualizada');
    },
    onError: (err: unknown) => toast.error(getErrMsg(err)),
  });
}

/** Nombre con el que se muestra un grupo cuando la empresa no eligió uno propio. */
export const ETIQUETA_GRUPO_DEFECTO = 'Grupo';

/**
 * Plural de la etiqueta de la empresa ("Evento" → "Eventos", "Lugar" → "Lugares", "Cruz" → "Cruces"). Con «de»
 * pluraliza lo de antes ("Centro de costos" → "Centros de costos"); si ya termina en «s» la deja igual.
 * Espejo de pluralizarEtiqueta del móvil.
 */
export function pluralizarEtiqueta(etiqueta: string): string {
  const palabras = etiqueta.trim().split(/\s+/);
  let i = palabras.length - 1;
  const de = palabras.findIndex((w, k) => k > 0 && /^(de|del)$/i.test(w));
  if (de > 0) i = de - 1;
  const w = palabras[i];
  palabras[i] = /s$/i.test(w) ? w
    : /z$/i.test(w) ? `${w.slice(0, -1)}ces`
    : /[aeiouáéíóú]$/i.test(w) ? `${w}s`
    : `${w}es`;
  return palabras.join(' ');
}

/**
 * ¿Usa la empresa los grupos de turnos y cómo los llama? Lo lee cualquier rol. Mientras carga, o si la
 * consulta falla, `usa` es false: lo nuevo no aparece hasta saber que la empresa lo encendió.
 * La clave lleva la empresa porque al cerrar sesión la caché no se limpia: sin ella, quien entra
 * después desde otra empresa vería las opciones de la anterior.
 */
export function useOpcionesGrupos() {
  const empresaId = useAuthStore(s => s.usuario?.empresa_id ?? null);
  const { data, isLoading } = useQuery({
    queryKey: ['opciones-grupos', empresaId],
    queryFn: configuracionApi.getOpcionesGrupos,
    enabled: empresaId !== null,
  });
  const etiqueta = data?.data.etiqueta_grupo?.trim() || ETIQUETA_GRUPO_DEFECTO;
  return {
    usa: data?.data.usa_grupos_turno ?? false,
    etiqueta,
    etiquetaPlural: pluralizarEtiqueta(etiqueta),
    isLoading,
  };
}

export function useReprocesarRecargos() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: configuracionApi.reprocesarRecargos,
    onSuccess: (res) => {
      // Reclasifica horas, pago y compensatorios de registros ya cargados en
      // caché (periodos/registros/liquidacion/compensatorios) — sin esto, el
      // período reprocesado seguía mostrando los valores de antes hasta que
      // el staleTime (60 s) expirara o se recargara la página a mano.
      qc.invalidateQueries({ queryKey: ['nomina'] });
      toast.success(
        res.data.registros_actualizados > 0
          ? `${res.data.registros_actualizados} registro(s) recalculados`
          : 'No había registros por recalcular en el período abierto'
      );
    },
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
export function usePuntosParaTurnos(enabled = true) {
  return useQuery({ queryKey: ['config', 'puntos', 'para-turnos'], queryFn: configuracionApi.getPuntosParaTurnos, staleTime: 60_000, enabled });
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
export function useUpdateGestor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: number } & Parameters<typeof configuracionApi.updateGestor>[1]) =>
      configuracionApi.updateGestor(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['config', 'gestores'] }); toast.success('Gestor editado'); },
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
export function useDeleteGestor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: configuracionApi.deleteGestor,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['config', 'gestores'] }); toast.success('Gestor eliminado'); },
    onError: (err: unknown) => toast.error(getErrMsg(err)),
  });
}
