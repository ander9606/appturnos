import { PlanetIllustration } from './PlanetIllustration';

interface Props {
  title: string;
  message?: string;
  /** `empty` = nada todavía (por defecto) · `search` = sin resultados de una búsqueda · `done` = todo al día. */
  variant?: 'empty' | 'search' | 'done';
  action?: { label: string; onClick: () => void };
}

const ILUSTRACION = { empty: 'orbit', search: 'search', done: 'done' } as const;

/**
 * Estado "sin datos" de una lista, de marca: el planeta del logo con su anillo en órbita
 * (ErrorState lo muestra con el anillo fuera de lugar), con CTA opcional.
 */
export function EmptyState({ title, message, variant = 'empty', action }: Props) {
  return (
    <div className="flex flex-col items-center gap-1 py-10 text-center">
      <PlanetIllustration variant={ILUSTRACION[variant]} width={170} />
      <p className="mt-1 text-base font-bold text-foreground">{title}</p>
      {message && <p className="max-w-sm text-sm text-muted-foreground">{message}</p>}
      {action && (
        <button
          onClick={action.onClick}
          className="mt-3 rounded-xl border border-primary-300 bg-primary-50 px-5 py-2 text-sm font-semibold text-primary-700 hover:bg-primary-100"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
