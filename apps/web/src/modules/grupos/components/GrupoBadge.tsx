import { Layers } from 'lucide-react';

/**
 * Etiqueta con el grupo al que pertenece un turno ("Feria del Libro 2026"). La ven todos los roles y se
 * muestra siempre que el turno tenga grupo, aunque la empresa haya apagado la función: los grupos se
 * conservan. Sin grupo no dibuja nada. Va solo el nombre, sin la palabra "grupo": la empresa puede
 * llamarlo "Evento", "Obra"… Texto en `primary-700`: el naranja de marca no alcanza contraste en texto pequeño.
 */
export function GrupoBadge({ nombre }: { nombre?: string | null }) {
  const texto = nombre?.trim();
  if (!texto) return null;
  return (
    <span className="inline-flex items-center gap-1 max-w-full rounded-md bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary-700">
      <Layers size={11} className="flex-shrink-0" aria-hidden="true" />
      <span className="truncate">{texto}</span>
    </span>
  );
}
