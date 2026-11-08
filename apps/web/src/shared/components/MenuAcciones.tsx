import { useEffect, useRef, useState, type ReactNode } from 'react';
import { MoreHorizontal } from 'lucide-react';

export interface AccionMenu {
  key: string;
  label: string;
  icon?: ReactNode;
  onSelect: () => void;
  disabled?: boolean;
}

/**
 * Menú «⋯» para las acciones secundarias de una pantalla (la principal va visible aparte). Es un botón que abre una
 * lista: se cierra al elegir, al tocar fuera o con Escape, y se recorre con las flechas. Sin librerías.
 */
export function MenuAcciones({ etiqueta, acciones }: { etiqueta: string; acciones: AccionMenu[] }) {
  const [abierto, setAbierto] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);
  const boton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: MouseEvent) => { if (!raiz.current?.contains(e.target as Node)) setAbierto(false); };
    document.addEventListener('mousedown', fuera);
    return () => document.removeEventListener('mousedown', fuera);
  }, [abierto]);

  // Al abrir, el foco pasa a la primera opción para poder usar el teclado de inmediato.
  useEffect(() => {
    if (abierto) raiz.current?.querySelector<HTMLElement>('[role="menuitem"]:not([disabled])')?.focus();
  }, [abierto]);

  const cerrar = () => { setAbierto(false); boton.current?.focus(); };

  const teclas = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { e.stopPropagation(); cerrar(); return; }
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const items = [...(raiz.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])') ?? [])];
    const i = items.indexOf(document.activeElement as HTMLElement);
    const sig = e.key === 'ArrowDown' ? (i + 1) % items.length : (i - 1 + items.length) % items.length;
    items[sig]?.focus();
  };

  return (
    <div ref={raiz} className="relative" onKeyDown={teclas}>
      <button
        ref={boton}
        type="button"
        aria-haspopup="menu"
        aria-expanded={abierto}
        aria-label={etiqueta}
        onClick={() => setAbierto(a => !a)}
        className="p-2 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
      >
        <MoreHorizontal size={18} aria-hidden="true" />
      </button>
      {abierto && (
        <div role="menu" aria-label={etiqueta} className="absolute right-0 z-20 mt-1.5 min-w-[13rem] bg-card border border-border rounded-xl shadow-lg py-1">
          {acciones.map(a => (
            <button
              key={a.key}
              type="button"
              role="menuitem"
              disabled={a.disabled}
              onClick={() => { setAbierto(false); a.onSelect(); }}
              className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm text-left text-foreground hover:bg-muted focus:bg-muted focus:outline-none disabled:opacity-50"
            >
              {a.icon && <span className="text-muted-foreground" aria-hidden="true">{a.icon}</span>}
              {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
