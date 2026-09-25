import { Link } from 'react-router';
import { Reveal } from '../Reveal';

export function FinalCta() {
  return (
    <section className="bg-card px-6 py-24 text-center">
      <Reveal>
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">Empieza hoy</p>
        <h2 className="mx-auto mt-4 max-w-lg text-3xl font-extrabold tracking-tight text-foreground text-balance sm:text-4xl">
          ¿Listo para dejar de calcular a mano?
        </h2>
        <p className="mx-auto mt-4 max-w-md text-base leading-relaxed text-muted-foreground">
          Registra tu empresa gratis y configura tu primer turno en menos de 10 minutos.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            to="/registro"
            className="rounded-xl bg-primary px-7 py-3.5 text-sm font-bold text-white shadow-lg shadow-primary/20 transition-transform hover:-translate-y-0.5 hover:bg-primary-600"
          >
            Registrar mi empresa gratis
          </Link>
          <Link
            to="/login"
            className="rounded-xl border border-border px-7 py-3.5 text-sm font-semibold text-foreground transition-colors hover:border-primary hover:text-primary"
          >
            Ya tengo cuenta
          </Link>
        </div>
        <p className="mt-7 text-sm text-muted-foreground">
          ¿Dudas? Escríbenos a{' '}
          <a href="mailto:anderson960616@gmail.com" className="font-semibold text-primary hover:underline">
            anderson960616@gmail.com
          </a>{' '}
          · <a href="tel:+573204143661" className="font-semibold text-primary hover:underline">320 414 3661</a>
        </p>
      </Reveal>
    </section>
  );
}
