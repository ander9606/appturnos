import { Link, useNavigate } from 'react-router';
import {
  Calendar, MapPin, Wallet, Bell, Building2, Plug,
  Check, ArrowRight, Users, Briefcase,
} from 'lucide-react';

const FEATURES = [
  { icon: Calendar, titulo: 'Turnos y ofertas', desc: 'Publica turnos, recibe postulaciones y confirma personal en minutos.' },
  { icon: MapPin, titulo: 'Marcaje con geocerca', desc: 'Ingreso y egreso verificados por ubicación — sin planillas ni fraudes.' },
  { icon: Wallet, titulo: 'Nómina automática', desc: 'Recargos nocturnos, dominicales y festivos calculados según la ley colombiana.' },
  { icon: Bell, titulo: 'Notificaciones push', desc: 'Tu equipo se entera al instante de nuevas ofertas y cambios de turno.' },
  { icon: Building2, titulo: 'Multi-sede y multi-rol', desc: 'Administradores, jefes de turno, jefes de nómina y trabajadores en un solo lugar.' },
  { icon: Plug, titulo: 'Integraciones', desc: 'Conecta Zaturno con plataformas aliadas como logiq360 para cubrir personal por evento.' },
];

const PASOS_TURNOS = [
  { n: '01', t: 'Crea la oferta', d: 'Título, fecha, hora de inicio/fin y el lugar con su punto de marcaje.' },
  { n: '02', t: 'Define los puestos', d: 'Un puesto por cargo, con las plazas que necesitas cubrir y la tarifa por día de cada uno.' },
  { n: '03', t: 'Publícala', d: 'La oferta llega al equipo por notificación push y se abre a postulaciones.' },
  { n: '04', t: 'Confirma o rechaza', d: 'Revisa cada postulación y arma el equipo del turno puesto por puesto.' },
  { n: '05', t: 'Marcaje y calificación', d: 'El trabajador marca ingreso/egreso validado por geocerca; al terminar, lo calificas.' },
];

const PASOS_NOMINA = [
  { n: '01', t: 'Abre el período', d: 'Semanal, quincenal o mensual, según cómo pague tu empresa.' },
  { n: '02', t: 'Registra las horas', d: 'Cada marcaje se clasifica: ordinario, descanso, compensatorio, incapacidad, vacaciones o licencia.' },
  { n: '03', t: 'Recargos automáticos', d: 'Nocturno, dominical y festivo — incluida la Ley Emiliani — se calculan solos sobre las horas marcadas.' },
  { n: '04', t: 'Cierra el período', d: 'El valor hora queda congelado (snapshot): un cambio de salario después no altera períodos ya cerrados.' },
  { n: '05', t: 'Liquida y exporta', d: 'Genera el detalle final por trabajador y descárgalo en Excel.' },
];

const TARIFA_INCLUYE = [
  'Turnos y marcaje con geocerca',
  'Nómina con recargos de ley (nocturno, dominical, festivo)',
  'Multi-sede y multi-rol',
  'Notificaciones push',
  'Integración con logiq360',
];

const FAQS = [
  { q: '¿Necesito instalar algo?', a: 'No. Zaturno funciona desde el navegador para administradores y desde una app móvil (Expo) para los trabajadores.' },
  { q: '¿Cómo se calculan los recargos?', a: 'Aplicamos automáticamente los recargos nocturno, dominical y festivo colombianos, incluida la Ley Emiliani, sobre las horas marcadas.' },
  { q: '¿Qué es la integración con logiq360?', a: 'Si tu empresa opera con logiq360, las ofertas de personal por montaje/desmontaje se publican directamente en Zaturno y las horas y costos vuelven solos a cada evento.' },
];

function ZaturnoLogo() {
  return (
    <span className="inline-flex items-center gap-2 font-bold tracking-tight text-lg text-foreground">
      <span
        className="w-7 h-7 rounded-lg flex items-center justify-center"
        style={{ background: 'linear-gradient(135deg, #FF7150, #E83E1F)' }}
      >
        <Calendar size={16} className="text-white" />
      </span>
      Zaturno
    </span>
  );
}

export function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <header className="sticky top-0 z-10 bg-background/90 backdrop-blur border-b border-border">
        <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between">
          <ZaturnoLogo />
          <div className="flex items-center gap-3">
            <Link to="/login" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Iniciar sesión
            </Link>
            <Link
              to="/registro"
              className="text-sm font-semibold text-white px-4 py-2 rounded-xl bg-primary hover:bg-primary-600 transition-colors"
            >
              Registrar empresa
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section
        className="px-5 pt-16 pb-24 text-center text-white"
        style={{ background: 'linear-gradient(160deg, #FF7150 0%, #FF5A3C 50%, #E83E1F 100%)' }}
      >
        <div className="max-w-2xl mx-auto">
          <span className="inline-block text-xs font-semibold uppercase tracking-widest text-white/80 mb-4">
            Turnos y nómina para tu empresa
          </span>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-balance">
            Cubre turnos y calcula nómina sin planillas
          </h1>
          <p className="mt-5 text-lg text-white/85 text-balance">
            Zaturno conecta a tu equipo con los turnos disponibles, verifica el marcaje por geocerca
            y liquida la nómina con los recargos de ley — todo en un solo lugar.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={() => navigate('/registro')}
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-white text-primary-600 font-semibold hover:bg-white/90 transition-colors inline-flex items-center justify-center gap-2"
            >
              Registra tu empresa <ArrowRight size={16} />
            </button>
            <a
              href="#como-funciona"
              className="w-full sm:w-auto px-6 py-3 rounded-xl border border-white/40 text-white font-semibold hover:bg-white/10 transition-colors"
            >
              Ver cómo funciona
            </a>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-5 py-20">
        <div className="max-w-xl mx-auto text-center mb-12">
          <h2 className="text-3xl font-bold tracking-tight text-balance">Todo lo que necesita tu operación</h2>
          <p className="mt-3 text-muted-foreground">Del turno publicado a la nómina liquidada, sin salir de Zaturno.</p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map(({ icon: Icon, titulo, desc }) => (
            <div key={titulo} className="p-6 rounded-2xl border border-border bg-card">
              <div className="w-11 h-11 rounded-xl bg-primary-50 flex items-center justify-center mb-4">
                <Icon size={20} className="text-primary" />
              </div>
              <h3 className="font-semibold text-foreground mb-1.5">{titulo}</h3>
              <p className="text-sm text-muted-foreground">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Cómo funcionan los turnos */}
      <section id="como-funciona" className="bg-muted border-y border-border">
        <div className="max-w-6xl mx-auto px-5 py-20">
          <div className="max-w-xl mb-12">
            <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-primary-600 mb-3">
              <Calendar size={14} /> Turnos
            </span>
            <h2 className="text-3xl font-bold tracking-tight text-balance">De la oferta al turno cubierto</h2>
            <p className="mt-3 text-muted-foreground">Así se cubre un turno de principio a fin, con o sin logiq360 de por medio.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-6">
            {PASOS_TURNOS.map(p => (
              <div key={p.n}>
                <span className="text-sm font-mono font-bold text-primary">{p.n}</span>
                <h3 className="font-semibold text-foreground mt-2 mb-1.5">{p.t}</h3>
                <p className="text-sm text-muted-foreground">{p.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Cómo funciona la nómina */}
      <section className="max-w-6xl mx-auto px-5 py-20">
        <div className="max-w-xl mb-12">
          <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-primary-600 mb-3">
            <Wallet size={14} /> Nómina
          </span>
          <h2 className="text-3xl font-bold tracking-tight text-balance">De las horas marcadas al pago listo</h2>
          <p className="mt-3 text-muted-foreground">Cada hora que se marca en un turno alimenta la nómina del período, sin doble digitación.</p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-6">
          {PASOS_NOMINA.map(p => (
            <div key={p.n}>
              <span className="text-sm font-mono font-bold text-primary">{p.n}</span>
              <h3 className="font-semibold text-foreground mt-2 mb-1.5">{p.t}</h3>
              <p className="text-sm text-muted-foreground">{p.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Tarifa */}
      <section id="tarifa" className="max-w-6xl mx-auto px-5 py-20">
        <div className="max-w-xl mx-auto text-center mb-12">
          <h2 className="text-3xl font-bold tracking-tight text-balance">Una sola tarifa, sin letra pequeña</h2>
          <p className="mt-3 text-muted-foreground">Todas las funciones de Zaturno incluidas desde el primer día.</p>
        </div>
        <div className="max-w-md mx-auto p-8 rounded-2xl border border-primary shadow-lg shadow-primary/10 bg-card text-center">
          <ul className="space-y-3 mb-8 text-left">
            {TARIFA_INCLUYE.map(f => (
              <li key={f} className="flex items-start gap-2 text-sm text-foreground">
                <Check size={16} className="text-primary mt-0.5 flex-shrink-0" />
                {f}
              </li>
            ))}
          </ul>
          <button
            onClick={() => navigate('/registro')}
            className="w-full py-2.5 rounded-xl font-semibold text-sm bg-primary text-white hover:bg-primary-600 transition-colors"
          >
            Registra tu empresa
          </button>
        </div>
      </section>

      {/* Integración logiq360 */}
      <section className="max-w-6xl mx-auto px-5 pb-20">
        <div className="rounded-3xl border border-primary-200 bg-primary-50 p-8 lg:p-12 grid lg:grid-cols-2 gap-8 items-center">
          <div>
            <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-primary-600 mb-3">
              <Plug size={14} /> Integración · logiq360
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground text-balance">
              ¿Ya operas con logiq360? Cubre montajes sin salir de Zaturno
            </h2>
            <p className="mt-3 text-muted-foreground">
              Cuando logiq360 publica una orden que necesita personal por turnos, la oferta llega directo
              a Zaturno. Tu equipo confirma el turno y las horas y costos vuelven solos a cada evento.
            </p>
          </div>
          <div className="flex items-center justify-center gap-4 bg-card rounded-2xl border border-border p-8">
            <div className="flex flex-col items-center gap-2">
              <div className="w-14 h-14 rounded-2xl bg-slate-900 flex items-center justify-center">
                <Briefcase size={22} className="text-white" />
              </div>
              <span className="text-xs font-semibold text-muted-foreground">logiq360</span>
            </div>
            <span className="text-2xl text-muted-foreground">+</span>
            <div className="flex flex-col items-center gap-2">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #FF7150, #E83E1F)' }}>
                <Users size={22} className="text-white" />
              </div>
              <span className="text-xs font-semibold text-primary-600">Zaturno</span>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="max-w-2xl mx-auto px-5 pb-20">
        <h2 className="text-3xl font-bold tracking-tight text-center text-balance mb-10">¿Tienes dudas?</h2>
        <div className="space-y-3">
          {FAQS.map(f => (
            <details key={f.q} className="group rounded-xl border border-border bg-card px-5 py-4">
              <summary className="cursor-pointer font-semibold text-foreground list-none flex items-center justify-between gap-4">
                {f.q}
                <span className="text-muted-foreground group-open:rotate-45 transition-transform">+</span>
              </summary>
              <p className="mt-3 text-sm text-muted-foreground">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* CTA final */}
      <section className="text-white text-center px-5 py-20" style={{ background: 'linear-gradient(160deg, #FF7150 0%, #E83E1F 100%)' }}>
        <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-balance">Empieza a cubrir turnos hoy</h2>
        <button
          onClick={() => navigate('/registro')}
          className="mt-6 px-6 py-3 rounded-xl bg-white text-primary-600 font-semibold hover:bg-white/90 transition-colors inline-flex items-center gap-2"
        >
          Registra tu empresa <ArrowRight size={16} />
        </button>
      </section>

      {/* Footer */}
      <footer className="max-w-6xl mx-auto px-5 py-10 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
        <ZaturnoLogo />
        <div className="flex items-center gap-5">
          <Link to="/login" className="hover:text-foreground transition-colors">Iniciar sesión</Link>
          <Link to="/privacidad" className="hover:text-foreground transition-colors">Privacidad</Link>
          <Link to="/terminos" className="hover:text-foreground transition-colors">Términos</Link>
        </div>
      </footer>
    </div>
  );
}
