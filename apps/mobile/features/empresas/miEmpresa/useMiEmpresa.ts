import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { empresasApi } from '@api-client';
import type { ActualizarMiEmpresaPayload } from '@api-client';
import { showAlert } from '@/lib/alertDialog';
import { showToast } from '@/lib/toast';

export function useMiEmpresa() {
  return useQuery({
    queryKey: ['mi-empresa'],
    queryFn: () => empresasApi.obtenerMiEmpresa(),
    staleTime: 300_000,
  });
}

export function useActualizarEmpresa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (datos: ActualizarMiEmpresaPayload) =>
      empresasApi.actualizarMiEmpresa(datos),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mi-empresa'] });
      // Cambiar tipo_liquidacion recalcula el período en el backend (cierra el
      // abierto y abre uno nuevo con el ciclo correcto) — sin esto, todos los
      // que ya tenían 'periodos' en caché siguen viendo el período/tipo viejo
      // hasta que remonten la pantalla o pase el staleTime.
      qc.invalidateQueries({ queryKey: ['periodos'] });
    },
  });
}

/** Reclasifica los días ya registrados del período abierto con la config de recargos actual. */
export function useReprocesarRecargos() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => empresasApi.reprocesarRecargos(),
    onSuccess: ({ registros_actualizados }) => {
      qc.invalidateQueries({ queryKey: ['registros'] });
      qc.invalidateQueries({ queryKey: ['periodos'] });
      qc.invalidateQueries({ queryKey: ['liquidacion'] });
      qc.invalidateQueries({ queryKey: ['compensatorios'] });
      showToast(
        registros_actualizados > 0
          ? `${registros_actualizados} registro(s) recalculados.`
          : 'No había registros por recalcular en el período abierto.',
      );
    },
    onError: () => showAlert('Error', 'No se pudo reprocesar el período. Intenta de nuevo.'),
  });
}
