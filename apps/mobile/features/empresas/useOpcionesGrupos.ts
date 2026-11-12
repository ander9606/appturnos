import { useQuery } from '@tanstack/react-query';
import { empresasApi } from '@api-client';

import { ETIQUETA_GRUPO_DEFECTO, pluralizarEtiqueta } from './etiquetaGrupo';

// Se reexportan para quien ya las importaba desde aquí.
export { ETIQUETA_GRUPO_DEFECTO, pluralizarEtiqueta };

/**
 * ¿Usa la empresa los grupos de turnos y cómo los llama ("Evento", "Obra"…)? Lo lee cualquier rol.
 * Mientras carga, o si la consulta falla, `usa` es false: lo nuevo no aparece hasta saber que la
 * empresa lo encendió. Al cambiar de sesión la caché se limpia entera (useAuthStore), así que no
 * hace falta la empresa en la clave.
 */
export function useOpcionesGrupos(enabled = true) {
  const { data, isLoading } = useQuery({
    queryKey: ['opciones-grupos'],
    queryFn: () => empresasApi.obtenerOpcionesGrupos(),
    enabled,
  });
  const etiqueta = data?.etiqueta_grupo?.trim() || ETIQUETA_GRUPO_DEFECTO;
  return {
    usa: data?.usa_grupos_turno ?? false,
    etiqueta,
    etiquetaPlural: pluralizarEtiqueta(etiqueta),
    isLoading,
  };
}
