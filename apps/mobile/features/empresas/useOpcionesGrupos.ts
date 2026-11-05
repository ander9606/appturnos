import { useQuery } from '@tanstack/react-query';
import { empresasApi } from '@api-client';

/** Nombre con el que se muestra un grupo cuando la empresa no eligió uno propio. */
export const ETIQUETA_GRUPO_DEFECTO = 'Grupo';

/**
 * ¿Usa la empresa los grupos de turnos y cómo los llama ("Evento", "Obra"…)? Lo lee cualquier rol.
 * Mientras carga, o si la consulta falla, `usa` es false: lo nuevo no aparece hasta saber que la
 * empresa lo encendió. Al cambiar de sesión la caché se limpia entera (useAuthStore), así que no
 * hace falta la empresa en la clave.
 */
export function useOpcionesGrupos() {
  const { data, isLoading } = useQuery({
    queryKey: ['opciones-grupos'],
    queryFn: () => empresasApi.obtenerOpcionesGrupos(),
  });
  return {
    usa: data?.usa_grupos_turno ?? false,
    etiqueta: data?.etiqueta_grupo?.trim() || ETIQUETA_GRUPO_DEFECTO,
    isLoading,
  };
}
