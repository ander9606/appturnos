import { useEffect } from 'react';

const SIZE_CLASS = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
} as const;

interface Props {
  onClose: () => void;
  children: React.ReactNode;
  size?: keyof typeof SIZE_CLASS;
  /** Formularios largos (ej. datos de un trabajador) que no caben en una pantalla. */
  scrollable?: boolean;
  /** false por defecto — evita perder datos de un formulario a medio llenar por un click accidental fuera. */
  closeOnBackdrop?: boolean;
  /** false para modales con su propio layout de secciones (header/lista/footer) que manejan su padding. */
  padded?: boolean;
  /** Clases extra para el layout del card — ej. "flex flex-col" en modales con header/footer fijos y contenido scrolleable. */
  className?: string;
}

/**
 * Primitivo de modal único para toda la app — backdrop, cierre con Escape, tamaño configurable.
 * ponytail: si un Modal abre un ConfirmModal encima (ej. "eliminar" dentro de un formulario),
 * Escape cierra ambos a la vez en vez de solo el de encima — cada instancia escucha su propio
 * keydown, no hay pila compartida. Upgrade path: stack global de modales abiertos si esto molesta.
 */
export function Modal({ onClose, children, size = 'md', scrollable = false, closeOnBackdrop = false, padded = true, className = '' }: Props) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={closeOnBackdrop ? onClose : undefined}
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={e => e.stopPropagation()}
        className={`bg-card rounded-2xl w-full ${padded ? 'p-6' : ''} ${SIZE_CLASS[size]} ${scrollable ? 'max-h-[85vh] overflow-y-auto' : ''} ${className}`}
      >
        {children}
      </div>
    </div>
  );
}
