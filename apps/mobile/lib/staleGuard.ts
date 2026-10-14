/**
 * Guarda contra respuestas async que llegan fuera de orden (red lenta +
 * tipeo rápido): solo la operación más reciente puede aplicar su resultado.
 * `invalidate()` descarta cualquier operación en vuelo sin iniciar una nueva
 * (ej. cuando el usuario borra el texto de búsqueda) — si no, una respuesta
 * tardía de la búsqueda larga puede pisar el estado recién limpiado.
 */
export function createStaleGuard() {
  let token = 0;
  return {
    start: () => ++token,
    isCurrent: (t: number) => t === token,
    invalidate: () => { token++; },
  };
}
