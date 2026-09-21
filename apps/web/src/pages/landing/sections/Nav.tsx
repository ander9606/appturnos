import { Link } from 'react-router';
import zaturnoLogo from '@/assets/zaturno-logo.png';

export function Nav() {
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-card/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3.5">
        <div className="flex items-center gap-2.5">
          <img src={zaturnoLogo} alt="" className="h-8 w-8 rounded-xl" />
          <span className="text-base font-bold tracking-tight text-foreground">Zaturno</span>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="#trabajadores"
            className="hidden rounded-lg px-3 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground sm:block"
          >
            Busco turnos
          </a>
          <Link
            to="/login"
            className="hidden rounded-lg px-3 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground sm:block"
          >
            Iniciar sesión
          </Link>
          <Link
            to="/registro"
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-600"
          >
            Registrar mi empresa
          </Link>
        </div>
      </div>
    </header>
  );
}
