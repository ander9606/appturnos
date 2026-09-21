import { Link } from 'react-router';
import { Reveal } from '../Reveal';
import { Phone } from '../simulator/PhoneChrome';
import { DashboardScreen } from '../simulator/TrabajadorScreens';

export function Hero() {
  return (
    <section
      className="rounded-b-[40px]"
      style={{ background: 'linear-gradient(160deg, #FF7150 0%, #FF5A3C 50%, #E83E1F 100%)' }}
    >
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-6 pb-16 pt-16 lg:grid-cols-2 lg:pb-24 lg:pt-20">
        <Reveal>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-white/70">
            Gestión de turnos y nómina
          </p>
          <h1 className="mt-4 text-4xl font-extrabold leading-[1.05] tracking-tight text-white text-balance sm:text-5xl">
            El control total de tu equipo en una sola app
          </h1>
          <p className="mt-5 max-w-md text-base leading-relaxed text-white/80">
            Turnos, asistencia, recargos de ley y liquidación de nómina — automatizados.
            Con turnos rotativos o con horario fijo, zaturno calcula la nómina de cualquier
            empresa colombiana.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              to="/registro"
              className="rounded-xl bg-white px-6 py-3.5 text-sm font-bold text-primary-600 shadow-lg shadow-black/10 transition-transform hover:-translate-y-0.5"
            >
              Registrar mi empresa
            </Link>
            <a
              href="#app"
              className="rounded-xl border border-white/30 px-6 py-3.5 text-sm font-semibold text-white/90 transition-colors hover:border-white/60 hover:text-white"
            >
              Ver la app
            </a>
          </div>
        </Reveal>

        <Reveal delay={150} className="flex justify-center lg:justify-end">
          <div className="animate-[zt-float_5s_ease-in-out_infinite] motion-reduce:animate-none">
            <Phone>
              <DashboardScreen />
            </Phone>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
