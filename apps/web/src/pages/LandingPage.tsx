import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router';
import {
  Calendar, MapPin, Wallet, Bell, Building2, Plug,
  Check, ArrowRight, Users, Briefcase, HardHat, Tent,
  UtensilsCrossed, Truck, Settings2, CheckCircle2, Sparkles,
} from 'lucide-react';

const BENEFICIOS = [
  { icon: Calendar, tono: 'primary' as const, titulo: 'Turnos y ofertas', desc: 'Cubre turnos sin cadenas de WhatsApp: publicas la oferta y tu equipo se postula solo.' },
  { icon: MapPin, tono: 'dark' as const, titulo: 'Marcaje con geocerca', desc: 'Evita pagar horas que nunca se trabajaron — el ingreso y el egreso se validan por ubicación real.' },
  { icon: Wallet, tono: 'primary' as const, titulo: 'Nómina automática', desc: 'Liquida la nómina en minutos, no en una tarde con calculadora y recargos a mano.' },
  { icon: Bell, tono: 'outline' as const, titulo: 'Notificaciones push', desc: 'Nadie se pierde un turno: tu equipo se entera al instante de ofertas y cambios.' },
  { icon: Building2, tono: 'dark' as const, titulo: 'Multi-sede y multi-rol', desc: 'Administradores, jefes de turno, jefes de nómina y trabajadores en un solo lugar.' },
  { icon: Plug, tono: 'outline' as const, titulo: 'Integraciones', desc: 'Si ya usas logiq360, el personal por turnos se cubre solo, sin doble digitación.' },
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

const AUDIENCIAS = [
  { icon: HardHat, label: 'Constructoras' },
  { icon: Tent, label: 'Empresas de eventos' },
  { icon: UtensilsCrossed, label: 'Catering' },
  { icon: Settings2, label: 'Operaciones' },
  { icon: Truck, label: 'Logística' },
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

/* ── Scroll reveal (IntersectionObserver, sin dependencias) ── */
function Reveal({ children, className = '', delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!('IntersectionObserver' in window)) { setVisible(true); return; }
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setVisible(true); io.disconnect(); }
    }, { threshold: 0.15 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ease-out ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

function WaveDivider({ fill, flip = false }: { fill: string; flip?: boolean }) {
  return (
    <div className="w-full overflow-hidden leading-none" style={{ height: 32, transform: flip ? 'scaleY(-1)' : undefined }} aria-hidden="true">
      <svg viewBox="0 0 1440 32" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full block">
        <path d="M0 32L1440 32L1440 16C1200 0 960 32 720 32C480 32 240 0 0 16L0 32Z" fill={fill} />
      </svg>
    </div>
  );
}

function DotPattern({ className = '' }: { className?: string }) {
  return (
    <div
      className={`absolute inset-0 pointer-events-none ${className}`}
      style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,0.35) 1px, transparent 1px)', backgroundSize: '22px 22px' }}
      aria-hidden="true"
    />
  );
}

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

/* ── Mockup del hero: teléfono con la app + tarjetas flotantes ── */
function HeroMockup() {
  return (
    <div className="relative mx-auto w-full max-w-[300px]">
      {/* Teléfono */}
      <div className="relative rounded-[2.5rem] bg-slate-900 p-2.5 shadow-2xl shadow-black/40 rotate-2">
        <div className="rounded-[2rem] bg-white overflow-hidden">
          <div className="px-4 pt-4 pb-3 flex items-center justify-between">
            <span className="font-bold text-sm text-foreground">Zaturno</span>
            <div className="w-6 h-6 rounded-full bg-primary-100" />
          </div>
          <div className="px-4 pb-4 space-y-2.5">
            <div className="rounded-2xl border border-border p-3">
              <p className="text-[11px] text-muted-foreground">Montaje Feria Expo</p>
              <p className="text-xs font-semibold text-foreground mt-0.5">Sáb 6:00 a.m. · Corferias</p>
              <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
                <div className="h-full w-3/4 rounded-full bg-primary" />
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">3/4 plazas cubiertas</p>
            </div>
            <div className="rounded-2xl bg-slate-900 p-3">
              <p className="text-[11px] text-white/60">Este período</p>
              <p className="text-sm font-bold text-white mt-0.5">$1.480.320</p>
              <p className="text-[10px] text-white/50 mt-0.5">Recargos incluidos</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tarjetas flotantes */}
      <div className="hidden sm:flex absolute -left-10 top-6 items-center gap-2 bg-white rounded-xl shadow-lg shadow-black/10 px-3 py-2 -rotate-6">
        <CheckCircle2 size={16} className="text-success flex-shrink-0" />
        <span className="text-xs font-medium text-foreground whitespace-nowrap">Turno confirmado</span>
      </div>
      <div className="hidden sm:flex absolute -right-16 top-[44%] items-center gap-2 bg-white rounded-xl shadow-lg shadow-black/10 px-3 py-2 rotate-3">
        <MapPin size={16} className="text-primary flex-shrink-0" />
        <span className="text-xs font-medium text-foreground whitespace-nowrap">Geocerca validada</span>
      </div>
      <div className="hidden sm:flex absolute -left-6 bottom-4 items-center gap-2 bg-white rounded-xl shadow-lg shadow-black/10 px-3 py-2 -rotate-3">
        <Wallet size={16} className="text-primary flex-shrink-0" />
        <span className="text-xs font-medium text-foreground whitespace-nowrap">Nómina calculada</span>
      </div>
    </div>
  );
}

/* ── Ilustraciones propias (SVG, tono de marca) ── */
function IlustracionTurno() {
  return (
    <svg viewBox="0 0 120 120" className="w-20 h-20" aria-hidden="true">
      <circle cx="60" cy="60" r="56" fill="#FFF1EE" />
      <rect x="34" y="40" width="52" height="40" rx="8" fill="#fff" stroke="#FFBFB0" strokeWidth="2" />
      <path d="M34 54h52" stroke="#FFBFB0" strokeWidth="2" />
      <circle cx="76" cy="72" r="12" fill="#FF5A3C" />
      <path d="M71 72l3.5 3.5L82 68" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

function IlustracionNomina() {
  return (
    <svg viewBox="0 0 120 120" className="w-20 h-20" aria-hidden="true">
      <circle cx="60" cy="60" r="56" fill="#FFF1EE" />
      <rect x="38" y="32" width="44" height="56" rx="6" fill="#fff" stroke="#FFBFB0" strokeWidth="2" />
      <path d="M46 46h28M46 56h28M46 66h16" stroke="#FFBFB0" strokeWidth="3" strokeLinecap="round" />
      <circle cx="80" cy="78" r="16" fill="#E83E1F" />
      <path d="M80 70v16M74 78h12" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

const TONOS = {
  primary: { box: 'bg-primary-50', icon: 'text-primary' },
  dark: { box: 'bg-slate-900', icon: 'text-white' },
  outline: { box: 'bg-white border border-border', icon: 'text-primary' },
};

export function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-white text-foreground">
      {/* Nav */}
      <header className="sticky top-0 z-10 bg-white/90 backdrop-blur border-b border-border">
        <div className="max-w-6xl mx-auto px-4 sm:px-5 h-16 flex items-center justify-between gap-2">
          <ZaturnoLogo />
          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
            <Link to="/login" className="hidden sm:inline text-sm font-medium text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap">
              Iniciar sesión
            </Link>
            <Link
              to="/registro"
              className="text-xs sm:text-sm font-semibold text-white px-3 py-2 sm:px-4 rounded-xl bg-primary hover:bg-primary-600 transition-colors whitespace-nowrap"
            >
              Registrar empresa
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden text-white" style={{ background: 'linear-gradient(160deg, #FF7150 0%, #FF5A3C 45%, #E83E1F 100%)' }}>
        <DotPattern className="opacity-40" />
        <div className="relative max-w-6xl mx-auto px-5 pt-16 pb-20 grid lg:grid-cols-2 gap-12 items-center">
          <div className="text-center lg:text-left">
            <span className="inline-block text-xs font-semibold uppercase tracking-widest text-white/80 mb-4">
              Turnos y nómina para tu empresa
            </span>
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-balance">
              Cubre turnos en minutos.<br />La nómina se liquida sola.
            </h1>
            <p className="mt-5 text-lg text-white/85 text-balance max-w-md mx-auto lg:mx-0">
              Zaturno conecta a tu equipo con los turnos disponibles, valida el marcaje por geocerca
              y calcula la nómina con los recargos de ley — todo desde el celular.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3">
              <button
                onClick={() => navigate('/registro')}
                className="w-full sm:w-auto px-6 py-3 rounded-xl bg-white text-primary-600 font-semibold hover:bg-white/90 transition-colors inline-flex items-center justify-center gap-2"
              >
                Registra tu empresa <ArrowRight size={16} />
              </button>
              <a
                href="#turnos"
                className="w-full sm:w-auto px-6 py-3 rounded-xl border border-white/40 text-white font-semibold hover:bg-white/10 transition-colors"
              >
                Ver cómo funciona
              </a>
            </div>
          </div>
          <HeroMockup />
        </div>
        <WaveDivider fill="#ffffff" />
      </section>

      {/* Beneficios */}
      <section className="bg-white">
        <div className="max-w-6xl mx-auto px-5 py-20">
          <Reveal className="max-w-xl mx-auto text-center mb-12">
            <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-primary-600 mb-3">
              <Sparkles size={14} /> Por qué Zaturno
            </span>
            <h2 className="text-3xl font-bold tracking-tight text-balance">Todo lo que necesita tu operación</h2>
            <p className="mt-3 text-muted-foreground">Del turno publicado a la nómina liquidada, sin salir de Zaturno.</p>
          </Reveal>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {BENEFICIOS.map(({ icon: Icon, titulo, desc, tono }, i) => (
              <Reveal key={titulo} delay={i * 70} className="p-6 rounded-3xl border border-border bg-card">
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-4 ${TONOS[tono].box}`}>
                  <Icon size={20} className={TONOS[tono].icon} />
                </div>
                <h3 className="font-semibold text-foreground mb-1.5">{titulo}</h3>
                <p className="text-sm text-muted-foreground">{desc}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Cómo funcionan los turnos */}
      <section id="turnos" className="bg-muted border-y border-border">
        <div className="max-w-6xl mx-auto px-5 py-20 grid lg:grid-cols-2 gap-12 items-center">
          <Reveal>
            <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-primary-600 mb-3">
              <Calendar size={14} /> Turnos
            </span>
            <h2 className="text-3xl font-bold tracking-tight text-balance">De la oferta al turno cubierto</h2>
            <p className="mt-3 text-muted-foreground mb-8">Así se cubre un turno de principio a fin, con o sin logiq360 de por medio.</p>
            <div className="space-y-5">
              {PASOS_TURNOS.map(p => (
                <div key={p.n} className="flex gap-4">
                  <span className="text-sm font-mono font-bold text-primary flex-shrink-0 w-6">{p.n}</span>
                  <div>
                    <h3 className="font-semibold text-foreground">{p.t}</h3>
                    <p className="text-sm text-muted-foreground mt-0.5">{p.d}</p>
                  </div>
                </div>
              ))}
            </div>
          </Reveal>
          <Reveal delay={150} className="flex flex-col items-center gap-6">
            <IlustracionTurno />
            <div className="w-full max-w-sm bg-card border border-border rounded-2xl p-5 shadow-xl shadow-slate-900/5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-xs text-muted-foreground">Montaje Feria Expo Bogotá</p>
                  <p className="text-sm font-semibold text-foreground">Sáb 14 jun · 6:00 a.m.</p>
                </div>
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-primary-100 text-primary-600">Publicada</span>
              </div>
              <div className="space-y-3">
                {[{ cargo: 'Montajista', cubierto: 3, total: 4, tarifa: '$85.000/día' }, { cargo: 'Supervisor', cubierto: 1, total: 1, tarifa: '$120.000/día' }].map(p => (
                  <div key={p.cargo} className="border border-border rounded-xl p-3">
                    <div className="flex items-center justify-between text-sm mb-1.5">
                      <span className="font-medium text-foreground">{p.cargo}</span>
                      <span className="text-xs text-muted-foreground">{p.tarifa}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${(p.cubierto / p.total) * 100}%` }} />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{p.cubierto}/{p.total} plazas cubiertas</p>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Cómo funciona la nómina */}
      <section className="bg-white">
        <div className="max-w-6xl mx-auto px-5 py-20 grid lg:grid-cols-2 gap-12 items-center">
          <Reveal className="order-2 lg:order-1 flex flex-col items-center gap-6">
            <IlustracionNomina />
            <div className="w-full max-w-sm bg-card border border-border rounded-2xl p-5 shadow-xl shadow-slate-900/5">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-semibold text-foreground">Período · Junio Q1</p>
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-success-light text-success">Liquidado</span>
              </div>
              <div className="space-y-2.5">
                {[{ tipo: 'Ordinarias', horas: 160, color: 'bg-slate-400' }, { tipo: 'Recargo nocturno', horas: 18.5, color: 'bg-primary' }, { tipo: 'Recargo dominical', horas: 8, color: 'bg-primary-300' }].map(f => (
                  <div key={f.tipo} className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground w-28 flex-shrink-0">{f.tipo}</span>
                    <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                      <div className={`h-full rounded-full ${f.color}`} style={{ width: `${Math.min(100, f.horas * 2)}%` }} />
                    </div>
                    <span className="text-xs font-medium text-foreground w-10 text-right flex-shrink-0">{f.horas}h</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-4 border-t border-border flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Total a pagar</span>
                <span className="text-lg font-bold text-foreground">$1.480.320</span>
              </div>
            </div>
          </Reveal>
          <Reveal delay={150} className="order-1 lg:order-2">
            <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-primary-600 mb-3">
              <Wallet size={14} /> Nómina
            </span>
            <h2 className="text-3xl font-bold tracking-tight text-balance">De las horas marcadas al pago listo</h2>
            <p className="mt-3 text-muted-foreground mb-8">Cada hora que se marca en un turno alimenta la nómina del período, sin doble digitación.</p>
            <div className="space-y-5">
              {PASOS_NOMINA.map(p => (
                <div key={p.n} className="flex gap-4">
                  <span className="text-sm font-mono font-bold text-primary flex-shrink-0 w-6">{p.n}</span>
                  <div>
                    <h3 className="font-semibold text-foreground">{p.t}</h3>
                    <p className="text-sm text-muted-foreground mt-0.5">{p.d}</p>
                  </div>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* Hecho para */}
      <section className="bg-muted border-y border-border">
        <div className="max-w-6xl mx-auto px-5 py-20">
          <Reveal className="max-w-xl mx-auto text-center mb-10">
            <h2 className="text-3xl font-bold tracking-tight text-balance">Hecho para equipos que trabajan por turnos</h2>
          </Reveal>
          <Reveal delay={100} className="flex flex-wrap items-center justify-center gap-3">
            {AUDIENCIAS.map(({ icon: Icon, label }) => (
              <span
                key={label}
                className="inline-flex items-center gap-2 bg-card border border-border rounded-full pl-3 pr-4 py-2 text-sm font-medium text-foreground hover:border-primary transition-colors"
              >
                <span className="w-7 h-7 rounded-full bg-primary-50 flex items-center justify-center">
                  <Icon size={14} className="text-primary" />
                </span>
                {label}
              </span>
            ))}
          </Reveal>
        </div>
      </section>

      {/* Tarifa */}
      <section id="tarifa" className="bg-white">
        <div className="max-w-6xl mx-auto px-5 py-20">
          <Reveal className="max-w-xl mx-auto text-center mb-12">
            <h2 className="text-3xl font-bold tracking-tight text-balance">Una sola tarifa, sin letra pequeña</h2>
            <p className="mt-3 text-muted-foreground">Todas las funciones de Zaturno incluidas desde el primer día.</p>
          </Reveal>
          <Reveal delay={100} className="max-w-md mx-auto p-8 rounded-3xl border border-primary shadow-xl shadow-primary/10 bg-card text-center">
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
          </Reveal>
        </div>
      </section>

      {/* Integración logiq360 */}
      <section className="bg-muted border-y border-border">
        <div className="max-w-6xl mx-auto px-5 py-20">
          <Reveal className="rounded-3xl border border-primary-200 bg-gradient-to-br from-primary-50 to-white p-8 lg:p-12 grid lg:grid-cols-2 gap-8 items-center">
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
            <div className="flex items-center justify-center gap-4 bg-card rounded-2xl border border-border p-8 shadow-lg shadow-slate-900/5">
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
          </Reveal>
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-white">
        <div className="max-w-2xl mx-auto px-5 py-20">
          <Reveal>
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
          </Reveal>
        </div>
      </section>

      {/* CTA final */}
      <section className="relative overflow-hidden text-white text-center px-5 py-20" style={{ background: 'linear-gradient(160deg, #FF7150 0%, #E83E1F 100%)' }}>
        <DotPattern className="opacity-30" />
        <div className="relative">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-balance">Empieza a cubrir turnos hoy</h2>
          <button
            onClick={() => navigate('/registro')}
            className="mt-6 px-6 py-3 rounded-xl bg-white text-primary-600 font-semibold hover:bg-white/90 transition-colors inline-flex items-center gap-2"
          >
            Registra tu empresa <ArrowRight size={16} />
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white max-w-6xl mx-auto px-5 py-10 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
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
