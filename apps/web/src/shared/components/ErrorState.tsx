import axios from 'axios';

interface Props {
  error: unknown;
  onRetry: () => void;
}

/** Estado de error de una lista — sin esto, un fetch fallido se veía igual que "no hay datos". */
export function ErrorState({ error, onRetry }: Props) {
  const message = axios.isAxiosError(error)
    ? (error.response?.data?.message as string | undefined) ?? 'No se pudo cargar la información.'
    : 'No se pudo cargar la información.';

  return (
    <div className="py-8 text-center">
      <p className="text-sm text-danger mb-2">{message}</p>
      <button onClick={onRetry} className="text-sm text-primary hover:text-primary-600 font-medium">
        Reintentar
      </button>
    </div>
  );
}
