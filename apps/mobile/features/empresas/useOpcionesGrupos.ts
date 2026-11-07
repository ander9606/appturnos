import { useQuery } from '@tanstack/react-query';
import { empresasApi } from '@api-client';

/** Nombre con el que se muestra un grupo cuando la empresa no eligió uno propio. */
export const ETIQUETA_GRUPO_DEFECTO = 'Grupo';

/**
 * Plural de la etiqueta de la empresa ("Evento" → "Eventos", "Obra" → "Obras", "Lugar" → "Lugares", "Cruz" → "Cruces").
 * Con «de» pluraliza lo de antes ("Centro de costos" → "Centros de costos"); si ya termina en «s» la deja igual.
 */
export function pluralizarEtiqueta(etiqueta: string): string {
  const palabras = etiqueta.trim().split(/\s+/);
  let i = palabras.length - 1;
  const de = palabras.findIndex((w, k) => k > 0 && /^(de|del)$/i.test(w));
  if (de > 0) i = de - 1;
  const w = palabras[i];
  const plural = /s$/i.test(w) ? w
    : /z$/i.test(w) ? `${w.slice(0, -1)}ces`
    : /[aeiouáéíóú]$/i.test(w) ? `${w}s`
    : `${w}es`;
  palabras[i] = plural;
  return palabras.join(' ');
}

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
