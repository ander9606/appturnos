import { Link } from 'react-router';
import { PlanetIllustration } from '@/shared/components/PlanetIllustration';

export function NotFoundPage() {
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-2 bg-background px-6 text-center">
      <PlanetIllustration variant="search" width={200} />
      <h1 className="mt-2 text-xl font-bold text-foreground">Página no encontrada</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        La página que buscas no existe o fue movida.
      </p>
      <Link to="/" className="mt-3 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white">
        Volver al inicio
      </Link>
    </div>
  );
}
