import { Link } from 'react-router';

export function Footer() {
  return (
    <footer className="bg-primary-900 px-6 py-8 text-center text-xs font-medium tracking-wide text-white/35">
      <p>zaturno · Desarrollado en Colombia · Todos los derechos reservados {new Date().getFullYear()}</p>
      <p className="mt-2 flex items-center justify-center gap-4">
        <Link to="/terminos" className="hover:text-white/60 transition-colors">Términos y condiciones</Link>
        <Link to="/privacidad" className="hover:text-white/60 transition-colors">Política de privacidad</Link>
      </p>
    </footer>
  );
}
