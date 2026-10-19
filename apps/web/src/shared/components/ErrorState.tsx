import axios from 'axios';
import { PlanetIllustration } from './PlanetIllustration';

interface Props {
  error: unknown;
  onRetry: () => void;
}

type Kind = 'offline' | 'server' | 'generic';

/** Sin red axios no recibe respuesta (ERR_NETWORK); 5xx es falla nuestra; el resto trae mensaje del backend. */
function errorKind(error: unknown): Kind {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return 'offline';
  if (axios.isAxiosError(error)) {
    if (!error.response) return 'offline';
    if (error.response.status >= 500) return 'server';
  }
  return 'generic';
}

const COPY = {
  offline: { title: 'Sin conexión', body: 'No tienes conexión a internet. Revisa tu señal y vuelve a intentarlo.' },
  server:  { title: 'Algo se torció', body: 'Tuvimos un problema de nuestro lado. Intenta de nuevo en un momento.' },
} as const;

/**
 * Estado de error de una lista — sin esto, un fetch fallido se veía igual que "no hay datos".
 * Muestra el planeta del logo con el anillo fuera de lugar según el tipo de falla.
 */
export function ErrorState({ error, onRetry }: Props) {
  const kind = errorKind(error);
  const { title, body } = kind === 'generic'
    ? {
        title: 'No pudimos cargar esto',
        body: (axios.isAxiosError(error) && (error.response?.data?.message as string | undefined))
          || 'No se pudo cargar la información.',
      }
    : COPY[kind];

  return (
    <div role="alert" className="flex flex-col items-center gap-2 py-10 text-center">
      <PlanetIllustration variant={kind === 'offline' ? 'fallen' : 'tilted'} width={170} />
      <p className="text-base font-bold text-foreground">{title}</p>
      <p className="max-w-sm text-sm text-muted-foreground">{body}</p>
      <button
        onClick={onRetry}
        className="mt-2 rounded-xl border border-primary-300 bg-primary-50 px-5 py-2 text-sm font-semibold text-primary-700 hover:bg-primary-100"
      >
        Reintentar
      </button>
    </div>
  );
}
