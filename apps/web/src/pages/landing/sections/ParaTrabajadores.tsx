import { CheckCircle2, Search, Wallet, TrendingUp } from 'lucide-react';

import { Reveal } from '../Reveal';
import { Phone } from '../simulator/PhoneChrome';
import { OfertaDetalleScreen } from '../simulator/TrabajadorScreens';

export function ParaTrabajadores() {
  const beneficios = [
    { icon: CheckCircle2, text: 'Regístrate gratis en la app — no necesitas cédula ni que una empresa te invite primero' },
    { icon: Search, text: 'Postúlate con un toque a turnos "Disponibles" de cualquier empresa del directorio' },
    { icon: Wallet, text: 'Cobra con los recargos nocturnos, dominicales y festivos ya calculados' },
    { icon: TrendingUp, text: 'Construye tu calificación: entre mejor tu historial, más turnos te llegan' },
  ];
  return (
    <section id="trabajadores" className="bg-muted/60 px-6 py-20 sm:py-24">
      <div className="mx-auto grid max-w-6xl items-center gap-14 lg:grid-cols-2">
        <Reveal>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">Para trabajadores</p>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-foreground text-balance sm:text-4xl">
            ¿Buscas turnos por día?
          </h2>
          <p className="mt-4 max-w-md text-base leading-relaxed text-muted-foreground">
            Regístrate tú mismo desde la app, sin esperar la invitación de ninguna empresa: desde
            el directorio te postulas a turnos de empresas que ya usan Zaturno — eventos,
            restaurantes, seguridad, lo que se ajuste a tu disponibilidad.
          </p>
          <ul className="mt-7 flex flex-col gap-4">
            {beneficios.map((b) => (
              <li key={b.text} className="flex items-start gap-3">
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-primary-50">
                  <b.icon size={16} className="text-primary" />
                </div>
                <span className="pt-1 text-sm font-medium leading-snug text-foreground">{b.text}</span>
              </li>
            ))}
          </ul>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <a
              href="#app"
              className="rounded-xl bg-primary px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-primary/20 transition-transform hover:-translate-y-0.5 hover:bg-primary-600"
            >
              Regístrate gratis
            </a>
            <span className="text-sm text-muted-foreground">¿Ya trabajas en una empresa que usa Zaturno? Pídele que te agregue directamente.</span>
          </div>
        </Reveal>
        <Reveal delay={150} className="flex justify-center">
          <Phone>
            <OfertaDetalleScreen />
          </Phone>
        </Reveal>
      </div>
    </section>
  );
}
