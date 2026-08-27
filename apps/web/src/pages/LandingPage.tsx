import { Link } from 'react-router';
import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
  Calendar, MapPin, Wallet, Users, Bell, ShieldCheck,
  Bell as BellIcon, Search, Star, ChevronRight, Home,
  CalendarDays, Wallet as WalletIcon, Apple, PlayCircle,
  ChevronLeft, CheckCircle2, Plus, Minus, Briefcase, Crosshair, TrendingUp,
} from 'lucide-react';
import zaturnoLogo from '@/assets/zaturno-logo.png';

/**
 * Revela su contenido con un fade + slide-up al entrar en el viewport.
 * Si el usuario prefiere movimiento reducido, se muestra directo sin animar.
 */
function Reveal({
  children,
  className = '',
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      style={{ transitionDelay: `${delay}ms` }}
      className={`transition-all duration-700 ease-out ${
        visible ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'
      } ${className}`}
    >
      {children}
    </div>
  );
}

/**
 * Landing pública de zaturno.app — vive fuera del área autenticada.
 * Reusa los tokens de marca reales de index.css (mismo naranja que la app
 * móvil y el panel) en vez de una paleta de marca provisional.
 */
export function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <Nav />
      <Hero />
      <Stats />
      <Mockups />
      <ParaTrabajadores />
      <Pain />
      <HowItWorks />
      <Features />
      <Sectors />
      <FinalCta />
      <Footer />
    </div>
  );
}

// ── Nav ──────────────────────────────────────────────────────────────────

function Nav() {
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

// ── Hero ─────────────────────────────────────────────────────────────────

function Hero() {
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

// ── Stats ────────────────────────────────────────────────────────────────

function Stats() {
  const items = [
    { num: '100%', label: 'Recargos de ley colombiana' },
    { num: '0', label: 'Errores en nómina manual' },
    { num: '∞', label: 'Empresas en un solo sistema' },
  ];
  return (
    <section className="bg-primary-900">
      <div className="mx-auto grid max-w-6xl grid-cols-1 divide-y divide-white/15 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        {items.map((s, i) => (
          <Reveal key={s.label} delay={i * 100} className="px-8 py-10 text-center">
            <div className="text-4xl font-extrabold tabular-nums tracking-tight text-white sm:text-5xl">
              {s.num}
            </div>
            <div className="mt-2 text-xs font-semibold uppercase tracking-wide text-white/60">
              {s.label}
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

// ── Mockups gallery ──────────────────────────────────────────────────────

function Mockups() {
  const [role, setRole] = useState<Role>('trabajador');
  return (
    <section id="app" className="relative overflow-hidden px-6 py-20 sm:py-24">
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-24 h-[420px] w-[780px] -translate-x-1/2 rounded-full opacity-[0.07] blur-3xl"
        style={{ background: 'radial-gradient(ellipse, #FF5A3C 0%, transparent 70%)' }}
      />
      <Reveal className="relative mx-auto max-w-3xl text-center">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">La app</p>
        <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-foreground text-balance sm:text-4xl">
          Pantallas reales, no bocetos
        </h2>
        <p className="mt-4 text-base leading-relaxed text-muted-foreground">
          Usa este celular para hacerte una idea real de cómo funciona zaturno: elegí qué tipo
          de usuario simular y tocá la pantalla para navegar, igual que en tu propio teléfono.
        </p>
      </Reveal>

      <Reveal delay={100} className="mt-8 flex justify-center">
        <RolePills value={role} onChange={setRole} />
      </Reveal>

      <Reveal delay={150} className="mt-10">
        <PhoneSimulator role={role} />
      </Reveal>

      <Reveal delay={250}>
        <StoreBadges />
      </Reveal>
    </section>
  );
}

type Role = 'trabajador' | 'jefe_turnos' | 'nomina';
type Tab = 'inicio' | 'turnos' | 'nomina' | 'equipo';
type Detail =
  | { kind: 'turno'; org: string; title: string; meta: string; pago?: string; cobertura?: string }
  | { kind: 'miembro'; nombre: string; rol: string; inicial: string; color: string }
  | { kind: 'crear' }
  | { kind: 'marcaje' }
  | { kind: 'acumulado' };

function isGestorRole(role: Role): role is 'jefe_turnos' | 'nomina' {
  return role === 'jefe_turnos' || role === 'nomina';
}

const ROLES: { value: Role; label: string }[] = [
  { value: 'trabajador', label: 'Trabajador' },
  { value: 'jefe_turnos', label: 'Jefe de turnos' },
  { value: 'nomina', label: 'Nómina / Admin' },
];

function RolePills({ value, onChange }: { value: Role; onChange: (r: Role) => void }) {
  return (
    <div role="radiogroup" aria-label="Tipo de usuario a simular" className="inline-flex flex-wrap justify-center gap-1.5 rounded-full border border-border bg-card p-1.5">
      {ROLES.map((r) => {
        const active = r.value === value;
        return (
          <button
            key={r.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(r.value)}
            className={`rounded-full px-4 py-2 text-sm font-bold transition-colors ${
              active ? 'bg-primary text-white shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {r.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Un solo iPhone, interactivo: la barra inferior cambia de pestaña y tocar
 * una tarjeta abre su detalle (con volver) — igual que en la app real, pero
 * 100% visual, sin llamadas a la API. `role` decide qué ve cada tipo de
 * usuario, tal como en la app real (ver Role Matrix en CLAUDE.md). Al lado
 * (o debajo, en móvil) siempre hay una descripción de qué se puede hacer en
 * la pantalla que está mostrando en ese momento.
 */
function PhoneSimulator({ role }: { role: Role }) {
  const [tab, setTab] = useState<Tab>('inicio');
  const [detail, setDetail] = useState<Detail | null>(null);

  useEffect(() => {
    setTab('inicio');
    setDetail(null);
  }, [role]);

  const openDetail = (d: Detail) => setDetail(d);
  const closeDetail = () => setDetail(null);
  const goTab = (t: Tab) => {
    setDetail(null);
    setTab(t);
  };

  return (
    <div className="mx-auto flex max-w-3xl flex-col items-center gap-8 lg:flex-row lg:items-center lg:justify-center">
      <Phone>
        {detail ? (
          <DetailScreen detail={detail} onBack={closeDetail} />
        ) : (
          <TabScreen role={role} tab={tab} onTabSelect={goTab} onOpenDetail={openDetail} />
        )}
      </Phone>
      <ScreenInfoPanel info={getScreenInfo(role, tab, detail)} />
    </div>
  );
}

type ScreenInfo = { tag: string; title: string; body: string; bullets: string[] };

const SCREEN_INFO: Record<string, ScreenInfo> = {
  'inicio-trabajador': {
    tag: 'Inicio · Trabajador',
    title: 'Tu turno de un vistazo',
    body: 'Ves tu turno activo, tus próximos turnos y accesos directos a lo que más usás — sin buscar en menús.',
    bullets: ['Marcar ingreso o salida con un toque', 'Ver cuántos turnos llevas completados', 'Saltar directo a tu quincena'],
  },
  'inicio-jefe': {
    tag: 'Inicio · Jefe de turnos',
    title: 'El estado de tu operación, hoy',
    body: 'De un vistazo sabés cuántos turnos hay hoy y cuáles siguen sin cubrir, para reaccionar antes de que sea tarde.',
    bullets: ['Crear un turno nuevo en segundos', 'Ver qué turnos faltan por cubrir', 'Saltar al equipo completo'],
  },
  'inicio-nomina': {
    tag: 'Inicio · Nómina / Admin',
    title: 'Cuánto falta para liquidar',
    body: 'Ves los días que quedan del período y cuánto llevas acumulado en nómina, antes de entrar al detalle.',
    bullets: ['Saltar directo a liquidar el período', 'Ver el acumulado de cada empleado', 'Revisar el equipo completo'],
  },
  'turnos-trabajador': {
    tag: 'Turnos · Trabajador',
    title: 'Tus turnos y los disponibles',
    body: "Revisás los turnos que ya tenés asignados y, en la pestaña \"Disponibles\", te postulás a turnos de otras empresas que también usan zaturno.",
    bullets: ['Ver fecha, hora y lugar de cada turno', 'Tocar un turno para ver el pago exacto', 'Postularte a turnos abiertos'],
  },
  'turnos-gestor': {
    tag: 'Turnos · Gestor',
    title: 'Todos los turnos, con su cobertura',
    body: 'Cada turno muestra cuántas plazas tiene cubiertas, para saber de un vistazo dónde falta gente.',
    bullets: ['Crear un turno nuevo con el botón +', 'Ver cuántas plazas faltan por cubrir', 'Tocar un turno para editarlo'],
  },
  'nomina-trabajador': {
    tag: 'Nómina · Trabajador',
    title: 'Lo que llevas acumulado',
    body: 'Ves el total del período desglosado por tipo de hora — ordinarias, nocturnas, festivas — y el detalle día a día.',
    bullets: ['Ver el total acumulado del período', 'Tocar el resumen para ver el detalle', 'Revisar cada registro diario'],
  },
  'nomina-gestor': {
    tag: 'Nómina · Admin',
    title: 'Liquidación de todo el equipo',
    body: 'Ves cuánto se le debe a cada empleado antes de cerrar el período, con los recargos de ley ya calculados.',
    bullets: ['Liquidar el período con un toque', 'Ver el acumulado de cada empleado', 'Tocar a alguien para ver su detalle'],
  },
  'equipo-trabajador': {
    tag: 'Equipo · Trabajador',
    title: 'Quién más está en tu equipo',
    body: 'Una vista de solo lectura de tus compañeros — no accedés a su nómina ni a sus datos privados.',
    bullets: ['Ver quién está activo hoy', 'Buscar a un compañero', 'Sin acceso a la nómina ajena'],
  },
  'equipo-gestor': {
    tag: 'Equipo · Gestor',
    title: 'Tu equipo completo',
    body: 'Administrás quién está activo y accedés al perfil de cada trabajador con un toque.',
    bullets: ['Buscar a cualquier trabajador', 'Tocar un perfil para ver su detalle', 'Ver el rol y estado de cada uno'],
  },
  'turno-trabajador': {
    tag: 'Detalle de turno',
    title: 'Todo antes de aplicar',
    body: 'Fecha, lugar, plazas disponibles y el pago exacto — toda la info para decidir antes de postularte.',
    bullets: ['Ver el pago exacto del turno', 'Confirmar fecha, hora y lugar', 'Aplicar con un solo toque'],
  },
  'turno-gestor': {
    tag: 'Detalle de turno',
    title: 'Gestioná este turno',
    body: 'Ves cuántas plazas siguen libres y podés editar el turno sin salir de la pantalla.',
    bullets: ['Ver la cobertura de plazas', 'Editar fecha, hora o tarifa', 'Confirmar el lugar asignado'],
  },
  miembro: {
    tag: 'Perfil',
    title: 'Ficha del trabajador',
    body: 'Horas del mes, acumulado y acceso rápido a sus turnos asignados.',
    bullets: ['Ver horas y acumulado del mes', 'Revisar sus turnos asignados', 'Confirmar su rol y estado'],
  },
  crear: {
    tag: 'Nuevo turno',
    title: 'Publicar un turno toma segundos',
    body: 'Definís título, horario, lugar y plazas — el turno queda visible para tu equipo al instante.',
    bullets: ['Definir horario y lugar', 'Elegir cuántas plazas necesitás', 'Publicarlo para tu equipo'],
  },
  marcaje: {
    tag: 'Marcar ingreso',
    title: 'Geofencing en tiempo real',
    body: 'El trabajador solo puede fichar si está físicamente en el lugar de trabajo — validado por el servidor, no por el teléfono.',
    bullets: ['Verificar la distancia al punto de marcaje', 'Bloquear el fichaje fuera de rango', 'Registrar la hora exacta'],
  },
  acumulado: {
    tag: 'Resumen del período',
    title: 'Cuánto llevas y cuánto falta',
    body: 'Progreso del período en días y el desglose de horas ordinarias, extra y festivas.',
    bullets: ['Ver el acumulado en tiempo real', 'Revisar horas extra y festivas', 'Saber cuántos días faltan'],
  },
};

function getScreenInfo(role: Role, tab: Tab, detail: Detail | null): ScreenInfo {
  const isGestor = isGestorRole(role);
  const key = (() => {
    if (detail) {
      if (detail.kind === 'turno') return detail.cobertura ? 'turno-gestor' : 'turno-trabajador';
      return detail.kind;
    }
    if (tab === 'inicio') return isGestor ? (role === 'nomina' ? 'inicio-nomina' : 'inicio-jefe') : 'inicio-trabajador';
    if (tab === 'turnos') return isGestor ? 'turnos-gestor' : 'turnos-trabajador';
    if (tab === 'nomina') return role === 'nomina' ? 'nomina-gestor' : 'nomina-trabajador';
    return isGestor ? 'equipo-gestor' : 'equipo-trabajador';
  })();
  return SCREEN_INFO[key];
}

function ScreenInfoPanel({ info }: { info: ScreenInfo }) {
  return (
    <div className="w-full max-w-xs flex-shrink-0 rounded-2xl border border-border bg-card p-6">
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">{info.tag}</p>
      <h3 className="mt-2 text-lg font-extrabold text-foreground text-balance">{info.title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{info.body}</p>
      <ul className="mt-5 flex flex-col gap-2.5">
        {info.bullets.map((b) => (
          <li key={b} className="flex items-start gap-2 text-sm font-medium text-foreground">
            <CheckCircle2 size={16} className="mt-0.5 flex-shrink-0 text-primary" />
            {b}
          </li>
        ))}
      </ul>
    </div>
  );
}

function TabScreen({
  role,
  tab,
  onTabSelect,
  onOpenDetail,
}: {
  role: Role;
  tab: Tab;
  onTabSelect: (t: Tab) => void;
  onOpenDetail: (d: Detail) => void;
}) {
  const isGestor = isGestorRole(role);

  if (tab === 'inicio') {
    return isGestor ? (
      <GestorDashboardScreen role={role} onTabSelect={onTabSelect} onOpenDetail={onOpenDetail} />
    ) : (
      <DashboardScreen onTabSelect={onTabSelect} onOpenDetail={onOpenDetail} />
    );
  }
  if (tab === 'turnos') {
    return isGestor ? (
      <GestorTurnosScreen onTabSelect={onTabSelect} onOpenDetail={onOpenDetail} />
    ) : (
      <TurnosScreen onTabSelect={onTabSelect} onOpenDetail={onOpenDetail} />
    );
  }
  if (tab === 'nomina') {
    return role === 'nomina' ? (
      <NominaGestorScreen onTabSelect={onTabSelect} onOpenDetail={onOpenDetail} />
    ) : (
      <NominaScreen onTabSelect={onTabSelect} onOpenDetail={onOpenDetail} />
    );
  }
  return (
    <EquipoScreen
      onTabSelect={onTabSelect}
      onOpenDetail={isGestor ? onOpenDetail : undefined}
    />
  );
}

function DetailScreen({ detail, onBack }: { detail: Detail; onBack: () => void }) {
  switch (detail.kind) {
    case 'turno':
      return <OfertaDetalleScreen turno={detail} onBack={onBack} />;
    case 'miembro':
      return <MiembroDetalleScreen miembro={detail} onBack={onBack} />;
    case 'marcaje':
      return <MarcarIngresoScreen onBack={onBack} />;
    case 'acumulado':
      return <AcumuladoScreen onBack={onBack} />;
    case 'crear':
      return <CrearTurnoScreen onBack={onBack} />;
  }
}

function StoreBadges() {
  return (
    <div className="mx-auto mt-16 flex max-w-6xl flex-col items-center gap-4">
      <p className="text-sm font-semibold text-muted-foreground">
        Muy pronto disponible para descargar
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <StoreBadge icon={Apple} eyebrow="Próximamente en" store="App Store" />
        <StoreBadge icon={PlayCircle} eyebrow="Próximamente en" store="Google Play" />
      </div>
    </div>
  );
}

function StoreBadge({
  icon: Icon,
  eyebrow,
  store,
}: {
  icon: typeof Apple;
  eyebrow: string;
  store: string;
}) {
  return (
    <div
      className="flex cursor-default items-center gap-2.5 rounded-xl border border-border bg-foreground px-4 py-2.5 opacity-90"
      aria-label={`${store}: ${eyebrow.toLowerCase()}`}
    >
      <Icon size={22} className="text-white" />
      <div className="text-left leading-tight">
        <div className="text-[9px] font-medium uppercase tracking-wide text-white/60">{eyebrow}</div>
        <div className="text-sm font-bold text-white">{store}</div>
      </div>
    </div>
  );
}

// ── Para trabajadores ───────────────────────────────────────────────────

function ParaTrabajadores() {
  const beneficios = [
    { icon: Search, text: 'Ve turnos "Disponibles" de otras empresas, no solo de la que te invitó' },
    { icon: CheckCircle2, text: 'Postúlate con un toque — sin llamadas ni cadenas de WhatsApp' },
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
            Activa tu cuenta con la empresa que te invitó y no te quedes ahí: desde la pestaña
            "Disponibles" puedes ver y postularte a turnos de otras empresas que también usan
            Zaturno — eventos, restaurantes, seguridad, lo que se ajuste a tu disponibilidad.
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
            <Link
              to="/login"
              className="rounded-xl bg-primary px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-primary/20 transition-transform hover:-translate-y-0.5 hover:bg-primary-600"
            >
              Activar mi cuenta
            </Link>
            <span className="text-sm text-muted-foreground">¿Tu empresa aún no usa Zaturno? Pídele que te agregue.</span>
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

// ── Pain ─────────────────────────────────────────────────────────────────

function Pain() {
  const items = [
    {
      q: '"¿Cuántos trabajadores llegaron hoy y a qué hora?"',
      a: 'Sin zaturno: llamas uno por uno o esperas que te reporten por WhatsApp. Con zaturno: lo ves en tiempo real, con la ubicación exacta del registro.',
    },
    {
      q: '"¿Cuánto le toca de nocturno a cada trabajador este mes?"',
      a: 'Sin zaturno: calculas manualmente con tablas de Excel, con margen de error. Con zaturno: los recargos nocturnos, dominicales y festivos se calculan solos, al centavo — tengas turnos rotativos o nómina de horario fijo.',
    },
    {
      q: '"¿Cómo le notifico a mi equipo el cambio de turno?"',
      a: 'Sin zaturno: grupos de WhatsApp, llamadas y mensajes que se pierden. Con zaturno: notificaciones push instantáneas a cada empleado, con confirmación de lectura.',
    },
  ];
  return (
    <section className="bg-card px-6 py-20 sm:py-24">
      <Reveal className="mx-auto max-w-2xl text-center">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">El problema</p>
        <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
          ¿Te suena familiar?
        </h2>
      </Reveal>
      <div className="mx-auto mt-14 grid max-w-6xl grid-cols-1 gap-px overflow-hidden rounded-2xl bg-border md:grid-cols-3">
        {items.map((p, i) => (
          <Reveal key={p.q} delay={i * 100}>
            <div className="h-full border-t-[3px] border-primary bg-background px-7 py-9 transition-transform duration-300 hover:-translate-y-1">
              <p className="text-base font-bold leading-snug text-foreground">{p.q}</p>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{p.a}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

// ── How it works ─────────────────────────────────────────────────────────

function HowItWorks() {
  const steps = [
    {
      title: 'Configuras tus turnos y equipo',
      body: 'Crea los períodos de nómina, asigna roles a cada trabajador y define los lugares de trabajo con geofencing. Una vez configurado, el sistema trabaja solo.',
    },
    {
      title: 'Tus empleados fichan desde el celular',
      body: 'El trabajador marca entrada y salida desde su app. Si no está en la ubicación asignada, el sistema lo detecta. Sin tarjetas, sin relojes biométricos.',
    },
    {
      title: 'La nómina se calcula sola',
      body: 'Al cerrar el período, zaturno suma las horas ordinarias, nocturnas, dominicales y festivas de cada empleado aplicando los recargos del Código Sustantivo del Trabajo — con turnos rotativos o con horario fijo.',
    },
    {
      title: 'Liquidás con un toque',
      body: 'Revisas el resumen, aprobás y quedás con el histórico de cada período guardado. Todo trazable, todo auditable.',
    },
  ];

  const week = [
    { name: 'Carlos M.', shifts: ['M', 'M', '', 'M', 'M', 'T'] },
    { name: 'Luisa R.', shifts: ['N', 'N', 'N', '', '', 'N'] },
    { name: 'Pedro V.', shifts: ['T', '', 'T', 'T', 'T', ''] },
    { name: 'Ana G.', shifts: ['✓', '✓', 'M', 'M', '', 'M'] },
  ];
  const shiftStyle: Record<string, string> = {
    M: 'bg-primary text-white',
    N: 'bg-info text-white',
    T: 'bg-[#7B4F9E] text-white',
    '✓': 'bg-warning text-primary-900',
    '': 'bg-muted',
  };

  return (
    <section className="px-6 py-20 sm:py-24" id="como-funciona">
      <div className="mx-auto max-w-6xl">
        <Reveal>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">Cómo funciona</p>
          <h2 className="mt-3 max-w-lg text-3xl font-extrabold tracking-tight text-foreground text-balance sm:text-4xl">
            Del turno a la nómina, sin fricción
          </h2>
        </Reveal>

        <div className="mt-14 grid gap-16 lg:grid-cols-2">
          <div className="flex min-w-0 flex-col gap-9">
            {steps.map((s, i) => (
              <Reveal key={s.title} delay={i * 90} className="flex gap-5">
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl border-2 border-primary text-sm font-extrabold text-primary">
                  {i + 1}
                </div>
                <div>
                  <h4 className="text-base font-bold text-foreground">{s.title}</h4>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal delay={150} className="min-w-0">
            <p className="mb-3.5 text-xs font-bold uppercase tracking-[0.14em] text-primary">
              Vista de turnos — semana actual
            </p>
            <div className="overflow-x-auto rounded-2xl border border-border bg-card p-5">
              <div className="grid min-w-[420px] grid-cols-[80px_repeat(6,1fr)] gap-1">
                <div />
                {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map((d) => (
                  <div key={d} className="py-1 text-center text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                    {d}
                  </div>
                ))}
                {week.map((row) => (
                  <div key={row.name} className="contents">
                    <div className="flex items-center truncate pr-2 text-xs font-semibold text-foreground">
                      {row.name}
                    </div>
                    {row.shifts.map((s, i) => (
                      <div
                        key={i}
                        className={`flex h-7 items-center justify-center rounded text-xs font-bold ${shiftStyle[s]}`}
                      >
                        {s}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap gap-4">
                <Legend color="bg-primary" label="Mañana" />
                <Legend color="bg-info" label="Nocturno" />
                <Legend color="bg-[#7B4F9E]" label="Tarde" />
                <Legend color="bg-warning" label="Geoficó" />
                <Legend color="bg-muted" label="Descanso" />
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
      <span className={`h-2.5 w-2.5 rounded-sm ${color}`} />
      {label}
    </div>
  );
}

// ── Features ─────────────────────────────────────────────────────────────

function Features() {
  const items = [
    { icon: MapPin, title: 'Geofencing en check-in', body: 'El empleado solo puede marcar entrada si está físicamente en el lugar de trabajo. Validación en el servidor — no se puede falsificar desde el teléfono.' },
    { icon: Wallet, title: 'Nómina con recargos automáticos', body: 'Horas nocturnas (21:00–06:00), dominicales y festivos colombianos calculados al centavo. Incluye los festivos de Ley Emiliani y los móviles de Semana Santa.' },
    { icon: Users, title: 'Roles diferenciados', body: 'Admin, jefe de turnos, jefe de nómina, trabajador — cada uno ve solo lo que le corresponde. El trabajador no ve la nómina de sus compañeros.' },
    { icon: Bell, title: 'Notificaciones push', body: 'Alertas en tiempo real para reingresos pendientes, cambios de turno y cierres de período. Sin depender de WhatsApp.' },
    { icon: Calendar, title: 'Períodos flexibles', body: 'Semanal, quincenal o mensual — configura el esquema que tu empresa usa. Cambiar el período no afecta el histórico de nóminas anteriores.' },
    { icon: ShieldCheck, title: 'Multi-empresa segura', body: 'Cada empresa opera en aislamiento total. Los datos de tus trabajadores nunca se mezclan con los de otro cliente. Arquitectura multi-tenant desde el diseño.' },
  ];
  return (
    <section className="bg-muted/60 px-6 py-20 sm:py-24">
      <div className="mx-auto max-w-6xl">
        <Reveal>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">Funcionalidades</p>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
            Todo lo que necesitas, nada que no
          </h2>
        </Reveal>
        <div className="mt-14 grid grid-cols-1 gap-px overflow-hidden rounded-2xl bg-border sm:grid-cols-2">
          {items.map(({ icon: Icon, title, body }, i) => (
            <Reveal key={title} delay={(i % 2) * 90}>
              <div className="h-full border-l-[3px] border-transparent bg-card px-8 py-9 transition-all duration-300 hover:-translate-y-1 hover:border-primary">
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-primary-50">
                  <Icon size={20} className="text-primary" />
                </div>
                <h3 className="text-base font-bold text-foreground">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Sectors ──────────────────────────────────────────────────────────────

function Sectors() {
  const sectors = [
    { name: 'Restaurantes y F&B', desc: 'Turnos de cocina, servicio y domicilios con horarios variables' },
    { name: 'Seguridad privada', desc: 'Guardas en múltiples sedes, turnos nocturnos y festivos' },
    { name: 'Manufactura', desc: 'Plantas con tres turnos continuos y rotación de personal' },
    { name: 'Salud y clínicas', desc: 'Enfermeros, auxiliares y turnos de 12 horas en festivos' },
    { name: 'Oficinas y servicios', desc: 'Nómina de horario fijo, sin turnos rotativos — igual de automatizada' },
  ];
  return (
    <section className="bg-primary-900 px-6 py-20 sm:py-24">
      <Reveal className="mx-auto max-w-3xl text-center">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary-200">Industrias</p>
        <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-white text-balance sm:text-4xl">
          Con turnos rotativos o sin ellos, tu nómina queda al día
        </h2>
        <p className="mt-4 text-base leading-relaxed text-white/60">
          zaturno no es solo para negocios con turnos: es un sistema completo de nómina — también
          sirve para empresas con horario fijo que quieren automatizar sus recargos y liquidaciones.
        </p>
      </Reveal>
      <div className="mx-auto mt-12 grid max-w-6xl grid-cols-1 gap-px sm:grid-cols-2 lg:grid-cols-5">
        {sectors.map((s, i) => (
          <Reveal key={s.name} delay={i * 70}>
            <div className="h-full border border-white/10 bg-white/5 px-6 py-7 text-center transition-all duration-300 hover:-translate-y-1 hover:bg-white/10">
              <div className="text-sm font-bold text-white">{s.name}</div>
              <div className="mt-1.5 text-xs leading-relaxed text-white/50">{s.desc}</div>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

// ── Final CTA ────────────────────────────────────────────────────────────

function FinalCta() {
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

function Footer() {
  return (
    <footer className="bg-primary-900 px-6 py-8 text-center text-xs font-medium tracking-wide text-white/35">
      zaturno · Desarrollado en Colombia · Todos los derechos reservados 2025
    </footer>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// Device mockups — pantallas reales de la app, reconstruidas con los mismos
// tokens de marca (apps/mobile/lib/designTokens.ts) y estructura de
// apps/mobile/app/(tabs)/*.tsx e (auth)/login.tsx.
// ══════════════════════════════════════════════════════════════════════════

const GREEN = '#059669';
const GREEN_LIGHT = '#ECFDF5';
const ORANGE_LIGHT = '#FFF1EE';
const BLUE = '#3B82F6';
const BLUE_LIGHT = '#DBEAFE';
const VIOLET = '#7C3AED';
const AQUA = '#1BAF7A';
const PLACEHOLDER = '#94A3B8';

function Phone({ size = 'lg', children }: { size?: 'lg' | 'sm'; children: ReactNode }) {
  const isSm = size === 'sm';
  return (
    <div
      className={`relative flex-shrink-0 rounded-[34px] bg-[#12222b] shadow-[0_40px_80px_rgba(0,0,0,0.35)] ${
        isSm ? 'w-[168px] rounded-[26px] p-[7px]' : 'w-[228px] p-[9px]'
      }`}
    >
      <div
        className={`absolute left-1/2 top-[9px] -translate-x-1/2 rounded-b-[10px] bg-[#12222b] ${
          isSm ? 'h-[12px] w-[56px] rounded-b-[8px]' : 'h-[16px] w-[76px]'
        }`}
      />
      <div
        className={`flex flex-col overflow-hidden rounded-[26px] bg-[#F8FAFC] ${
          isSm ? 'min-h-[330px] rounded-[20px]' : 'min-h-[430px]'
        }`}
      >
        {children}
      </div>
    </div>
  );
}

function StatusRow({ dark }: { dark?: boolean }) {
  return (
    <div className={`flex justify-between px-4 pt-2 text-[10px] font-bold ${dark ? 'text-foreground' : 'text-white/90'}`}>
      <span>9:41</span>
      <span>••• ▮▮▮</span>
    </div>
  );
}

function TabBar({ active, accent = '#FF5A3C', onSelect }: { active: Tab; accent?: string; onSelect?: (t: Tab) => void }) {
  const tabs = [
    { key: 'inicio', icon: Home, label: 'Inicio' },
    { key: 'turnos', icon: CalendarDays, label: 'Turnos' },
    { key: 'nomina', icon: WalletIcon, label: 'Nómina' },
    { key: 'equipo', icon: Users, label: 'Equipo' },
  ] as const;
  return (
    <div className="mt-auto flex border-t border-border bg-white px-1 pb-2 pt-1.5">
      {tabs.map((t) => {
        const isActive = t.key === active;
        return (
          <button
            key={t.key}
            type="button"
            onClick={() => onSelect?.(t.key)}
            aria-current={isActive ? 'page' : undefined}
            aria-label={t.label}
            className="flex flex-1 flex-col items-center gap-0.5"
            style={{ color: isActive ? accent : PLACEHOLDER }}
          >
            <t.icon size={13} />
            <span className="text-[7px] font-bold">{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function DashboardScreen({
  onTabSelect,
  onOpenDetail,
}: {
  onTabSelect?: (t: Tab) => void;
  onOpenDetail?: (d: Detail) => void;
} = {}) {
  return (
    <>
      <div className="rounded-b-[22px] bg-primary px-4 pb-5 pt-2">
        <StatusRow />
        <p className="mt-1.5 text-[11px] font-semibold text-white/85">Buenos días</p>
        <div className="mt-1 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-[26px] w-[26px] items-center justify-center rounded-full bg-white/25 text-[10px] font-extrabold text-white">
              CM
            </div>
            <span className="text-base font-extrabold text-white">Carlos</span>
          </div>
          <div className="relative flex h-[26px] w-[26px] items-center justify-center rounded-lg bg-white/20">
            <BellIcon size={13} className="text-white" />
            <div className="absolute -right-1 -top-1 flex h-3 min-w-3 items-center justify-center rounded-full bg-danger px-0.5 text-[7px] font-bold text-white">
              2
            </div>
          </div>
        </div>
        <p className="mt-0.5 text-[10px] font-semibold text-white/70">Trabajador · Turnos</p>
      </div>

      <div className="-mt-3.5 flex flex-1 flex-col gap-2.5 px-3 pb-2.5">
        <button
          type="button"
          onClick={() => onOpenDetail?.({ kind: 'marcaje' })}
          className="rounded-xl border bg-white px-3 py-2.5 text-left"
          style={{ borderColor: ORANGE_LIGHT }}
        >
          <span className="rounded-full px-2 py-0.5 text-[8px] font-extrabold" style={{ background: ORANGE_LIGHT, color: '#FF5A3C' }}>
            ● Turno activo
          </span>
          <p className="mt-1.5 text-[13px] font-extrabold text-foreground">Restaurante La Terraza</p>
          <div className="mt-1 flex items-center gap-1 text-[9px] font-semibold text-muted-foreground">
            <MapPin size={10} /> Zona Rosa · 14:00–22:00
          </div>
          <div className="mt-2 rounded-lg bg-primary py-1.5 text-center text-[9px] font-extrabold text-white">
            Marcar salida
          </div>
        </button>

        <div className="flex gap-2">
          {[
            { n: '1', l: 'Turnos hoy', c: 'text-foreground' },
            { n: '3', l: 'Próximos', c: 'text-info' },
            { n: '12', l: 'Completados', c: 'text-success' },
          ].map((s) => (
            <div key={s.l} className="flex-1 rounded-lg border border-border bg-white py-1.5 text-center">
              <div className={`text-[13px] font-extrabold tabular-nums ${s.c}`}>{s.n}</div>
              <div className="text-[7px] font-bold text-muted-foreground">{s.l}</div>
            </div>
          ))}
        </div>

        <div>
          <p className="mb-1.5 text-[10px] font-bold text-muted-foreground">Acciones rápidas</p>
          <div className="flex gap-2">
            {[
              { icon: CalendarDays, l: 'Mis Turnos', tab: 'turnos' as Tab },
              { icon: WalletIcon, l: 'Quincena', tab: 'nomina' as Tab },
              { icon: Star, l: 'Calificación', tab: 'equipo' as Tab },
            ].map((a) => (
              <button
                key={a.l}
                type="button"
                onClick={() => onTabSelect?.(a.tab)}
                className="flex flex-1 flex-col items-center gap-1 rounded-xl border border-border bg-white py-2"
              >
                <a.icon size={14} className="text-primary" />
                <span className="text-center text-[7px] font-bold text-foreground">{a.l}</span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between">
            <span className="text-[10px] font-bold text-muted-foreground">Próximos turnos</span>
            <button type="button" onClick={() => onTabSelect?.('turnos')} className="text-[9px] font-bold text-primary">
              Ver todos
            </button>
          </div>
          {[
            { org: 'Eventos BQ', t: 'Evento corporativo', d: 'Vie 8 Ago · 6:00 p.m.' },
            { org: 'La Terraza', t: 'Turno nocturno', d: 'Sáb 9 Ago · 9:00 p.m.' },
          ].map((r) => (
            <button
              key={r.t}
              type="button"
              onClick={() => onOpenDetail?.({ kind: 'turno', org: r.org, title: r.t, meta: r.d })}
              className="flex w-full items-center gap-2 border-b border-border py-1.5 text-left last:border-0"
            >
              <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-info" />
              <div className="flex-1">
                <div className="text-[10px] font-bold text-foreground">{r.t}</div>
                <div className="text-[8px] font-semibold text-muted-foreground">{r.d}</div>
              </div>
              <ChevronRight size={11} className="text-muted-foreground" />
            </button>
          ))}
        </div>
      </div>

      <TabBar active="inicio" onSelect={onTabSelect} />
    </>
  );
}

function TurnosScreen({
  onTabSelect,
  onOpenDetail,
}: {
  onTabSelect?: (t: Tab) => void;
  onOpenDetail?: (d: Detail) => void;
} = {}) {
  const days = [
    { d: 'L', n: 3 }, { d: 'M', n: 4 }, { d: 'M', n: 5, active: true },
    { d: 'J', n: 6 }, { d: 'V', n: 7 }, { d: 'S', n: 8 }, { d: 'D', n: 9 },
  ];
  return (
    <>
      <div className="border-b border-border bg-white px-3 pb-2 pt-2">
        <StatusRow dark />
        <p className="mt-1 text-[13px] font-extrabold text-foreground">Mis Turnos</p>
      </div>
      <div className="flex flex-1 flex-col gap-2 px-3 py-2.5">
        <div className="flex justify-between">
          {days.map((d, i) => (
            <div key={i} className="flex flex-col items-center gap-0.5 text-[8px] font-bold text-muted-foreground">
              <span>{d.d}</span>
              <span
                className={`flex h-[18px] w-[18px] items-center justify-center rounded-full text-[9px] font-bold ${
                  d.active ? 'bg-primary text-white' : 'text-foreground'
                }`}
              >
                {d.n}
              </span>
            </div>
          ))}
        </div>
        <div className="flex gap-3.5 border-b border-border">
          <span className="border-b-2 border-primary pb-1.5 text-[9px] font-bold text-primary">Mis Turnos</span>
          <span className="pb-1.5 text-[9px] font-bold text-muted-foreground">Disponibles</span>
        </div>
        {[
          { org: 'La Terraza', title: 'Turno de cocina', meta: '5 Ago · 14:00–22:00', tag: 'Confirmado', tagBg: GREEN_LIGHT, tagFg: GREEN, accent: '#FF5A3C', pago: '$85.000' },
          { org: 'Eventos BQ', title: 'Meseros · evento corporativo', meta: '8 Ago · 18:00–23:00', tag: 'Pendiente', tagBg: BLUE_LIGHT, tagFg: BLUE, accent: BLUE, pago: '$70.000' },
        ].map((c) => (
          <button
            key={c.org}
            type="button"
            onClick={() => onOpenDetail?.({ kind: 'turno', org: c.org, title: c.title, meta: c.meta, pago: c.pago })}
            className="flex overflow-hidden rounded-xl border border-border bg-white text-left"
          >
            <div className="w-1" style={{ background: c.accent }} />
            <div className="flex flex-1 flex-col gap-0.5 px-2.5 py-2">
              <span className="text-[8px] font-bold uppercase tracking-wide text-muted-foreground">{c.org}</span>
              <span className="text-[11px] font-extrabold text-foreground">{c.title}</span>
              <span className="text-[8px] font-semibold text-muted-foreground">{c.meta}</span>
              <span
                className="mt-0.5 w-fit rounded-full px-1.5 py-0.5 text-[7px] font-extrabold"
                style={{ background: c.tagBg, color: c.tagFg }}
              >
                {c.tag}
              </span>
            </div>
          </button>
        ))}
      </div>
      <TabBar active="turnos" onSelect={onTabSelect} />
    </>
  );
}

function Field({
  label,
  value,
  icon: Icon,
  className = '',
}: {
  label: string;
  value: string;
  icon?: typeof MapPin;
  className?: string;
}) {
  return (
    <div className={`rounded-lg border border-border bg-background px-2.5 py-1.5 ${className}`}>
      <div className="text-[7px] font-bold uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-0.5 flex items-center gap-1 text-[9px] font-bold text-foreground">
        {Icon && <Icon size={10} className="text-muted-foreground" />}
        {value}
      </div>
    </div>
  );
}

function CrearTurnoScreen({ onBack }: { onBack?: () => void } = {}) {
  return (
    <>
      <div className="border-b border-border bg-white px-3 pb-2 pt-2">
        <StatusRow dark />
        <button
          type="button"
          onClick={onBack}
          disabled={!onBack}
          className="mt-1 flex items-center gap-1.5"
        >
          <ChevronLeft size={14} className="text-foreground" />
          <p className="text-[11px] font-extrabold text-foreground">Nuevo turno</p>
        </button>
      </div>
      <div className="flex flex-1 flex-col gap-2 px-3 py-2.5">
        <Field label="Título" value="Turno de cocina" icon={Briefcase} />
        <Field label="Fecha" value="Vie 12 Ago" icon={CalendarDays} />
        <div className="flex gap-2">
          <Field label="Inicio" value="14:00" className="flex-1" />
          <Field label="Fin" value="22:00" className="flex-1" />
        </div>
        <Field label="Lugar" value="Zona Rosa, Bogotá" icon={MapPin} />
        <div className="flex items-center justify-between rounded-lg border border-border bg-background px-2.5 py-1.5">
          <span className="text-[7px] font-bold uppercase tracking-wide text-muted-foreground">Plazas</span>
          <div className="flex items-center gap-2.5">
            <Minus size={12} className="text-muted-foreground" />
            <span className="text-[10px] font-extrabold text-foreground">3</span>
            <Plus size={12} className="text-primary" />
          </div>
        </div>
        <Field label="Tarifa por turno" value="$85.000" />
        <div className="mt-auto rounded-lg bg-primary py-1.5 text-center text-[9px] font-extrabold text-white">
          Publicar turno
        </div>
      </div>
    </>
  );
}

function MarcarIngresoScreen({ onBack }: { onBack?: () => void } = {}) {
  return (
    <>
      <div className="rounded-b-[20px] bg-primary px-3 pb-4 pt-2">
        <StatusRow />
        <button type="button" onClick={onBack} disabled={!onBack} className="mt-1.5 flex items-center gap-1.5">
          <ChevronLeft size={14} className="text-white" />
          <span className="text-[10px] font-bold text-white">Restaurante La Terraza</span>
        </button>
      </div>
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4 py-4 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-success-light">
          <CheckCircle2 size={26} className="text-success" />
        </div>
        <div>
          <p className="text-[11px] font-extrabold text-foreground">Dentro del rango</p>
          <p className="mt-1 flex items-center justify-center gap-1 text-[8px] font-semibold text-muted-foreground">
            <Crosshair size={9} /> 38 m del punto de marcaje
          </p>
        </div>
        <div className="w-full rounded-lg bg-primary py-2 text-center text-[9px] font-extrabold text-white">
          Marcar ingreso
        </div>
        <p className="text-[7px] leading-relaxed text-muted-foreground">
          Este turno requiere que estés en la ubicación asignada para poder fichar.
        </p>
      </div>
    </>
  );
}

function MetaRow({ icon: Icon, text }: { icon: typeof MapPin; text: string }) {
  return (
    <div className="flex items-center gap-1.5 text-[8px] font-semibold text-muted-foreground">
      <Icon size={10} className="text-muted-foreground" /> {text}
    </div>
  );
}

function OfertaDetalleScreen({
  turno,
  onBack,
}: {
  turno?: Extract<Detail, { kind: 'turno' }>;
  onBack?: () => void;
} = {}) {
  const t: Extract<Detail, { kind: 'turno' }> = turno ?? {
    kind: 'turno',
    org: 'Eventos BQ',
    title: 'Meseros · evento corporativo',
    meta: 'Vie 8 Ago · 18:00 – 23:00',
    pago: '$85.000',
  };
  const isGestor = !!t.cobertura;
  return (
    <>
      <div className="border-b border-border bg-white px-3 pb-2 pt-2">
        <StatusRow dark />
        <button type="button" onClick={onBack} disabled={!onBack} className="mt-1 flex items-center gap-1.5">
          <ChevronLeft size={14} className="text-foreground" />
          <p className="text-[11px] font-extrabold text-foreground">Detalle del turno</p>
        </button>
      </div>
      <div className="flex flex-1 flex-col gap-2.5 px-3 py-2.5">
        <div>
          <span className="text-[8px] font-bold uppercase tracking-wide text-muted-foreground">{t.org}</span>
          <p className="text-[12px] font-extrabold text-foreground">{t.title}</p>
        </div>
        <div className="flex flex-col gap-1.5 rounded-xl border border-border bg-white px-2.5 py-2">
          <MetaRow icon={CalendarDays} text={t.meta} />
          <MetaRow icon={MapPin} text="Salón Andino, Bogotá" />
          <MetaRow icon={Briefcase} text="Mesero(a) · 2 plazas" />
        </div>
        <div className="rounded-xl px-2.5 py-2.5" style={{ background: GREEN_LIGHT }}>
          <p className="text-[7px] font-bold uppercase tracking-wide" style={{ color: GREEN }}>
            {isGestor ? 'Cobertura de plazas' : 'Pago por turno'}
          </p>
          <p className="text-[15px] font-extrabold" style={{ color: GREEN }}>
            {isGestor ? t.cobertura : t.pago ?? '$85.000'}
          </p>
        </div>
        <div className="mt-auto rounded-lg bg-primary py-1.5 text-center text-[9px] font-extrabold text-white">
          {isGestor ? 'Editar turno' : 'Aplicar a este turno'}
        </div>
      </div>
    </>
  );
}

function NominaScreen({
  onTabSelect,
  onOpenDetail,
}: {
  onTabSelect?: (t: Tab) => void;
  onOpenDetail?: (d: Detail) => void;
} = {}) {
  const registros = [
    { d: 'Lun 3 Ago', h: '6:58 a.m. – 3:02 p.m.', v: '8h 04' },
    { d: 'Mar 4 Ago', h: '6:55 a.m. – 3:00 p.m.', v: '8h 05' },
    { d: 'Mié 5 Ago', h: '9:58 p.m. – 6:03 a.m.', v: '8h 05 ★', highlight: true },
  ];
  return (
    <>
      <div
        className="relative overflow-hidden rounded-b-[18px] px-3 pb-3 pt-2"
        style={{ background: 'linear-gradient(155deg, #10B981 0%, #059669 55%, #065F46 100%)' }}
      >
        <div className="pointer-events-none absolute -right-5 -top-7 h-16 w-16 rounded-full bg-white/10" />
        <div className="pointer-events-none absolute -bottom-5 -left-6 h-12 w-12 rounded-full bg-white/10" />
        <StatusRow />
        <p className="mt-1 text-[11px] font-semibold text-white/85">Nómina</p>
        <p className="text-[12px] font-extrabold text-white">Quincena 1–15 Ago</p>
      </div>
      <div className="-mt-2 flex flex-1 flex-col gap-2.5 px-3 pb-2">
        <button
          type="button"
          onClick={() => onOpenDetail?.({ kind: 'acumulado' })}
          className="w-full rounded-xl border border-border bg-white px-2.5 py-2 text-left"
        >
          <p className="text-[8px] font-bold text-muted-foreground">Total del período</p>
          <p className="text-[15px] font-extrabold text-foreground">$1.240.500</p>
          <div className="mt-1.5 flex h-2 gap-px overflow-hidden rounded">
            <span style={{ flex: 5, background: PLACEHOLDER }} />
            <span style={{ flex: 2, background: AQUA }} />
            <span style={{ flex: 1.5, background: '#EB6834' }} />
            <span style={{ flex: 1, background: VIOLET }} />
          </div>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {[
              { c: PLACEHOLDER, l: 'Ordinarias' },
              { c: AQUA, l: 'Nocturnas' },
              { c: '#EB6834', l: 'Festivas' },
              { c: VIOLET, l: 'Extra' },
            ].map((l) => (
              <span key={l.l} className="flex items-center gap-1 text-[7px] font-bold text-muted-foreground">
                <span className="h-1.5 w-1.5 rounded-sm" style={{ background: l.c }} /> {l.l}
              </span>
            ))}
          </div>
        </button>
        <p className="text-[10px] font-bold text-muted-foreground">Registros</p>
        {registros.map((r) => (
          <div key={r.d} className="flex items-center justify-between border-b border-border py-1.5 last:border-0">
            <div>
              <div className="text-[10px] font-bold text-foreground">{r.d}</div>
              <div className="text-[8px] font-semibold text-muted-foreground">{r.h}</div>
            </div>
            <div className="text-[9px] font-extrabold" style={{ color: r.highlight ? GREEN : undefined }}>
              {r.v}
            </div>
          </div>
        ))}
      </div>
      <TabBar active="nomina" accent={GREEN} onSelect={onTabSelect} />
    </>
  );
}

function MiniStat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex-1 rounded-lg border border-border bg-white py-1.5 text-center">
      <div className="text-[11px] font-extrabold text-foreground" style={color ? { color } : undefined}>
        {value}
      </div>
      <div className="text-[7px] font-bold text-muted-foreground">{label}</div>
    </div>
  );
}

function AcumuladoScreen({ onBack }: { onBack?: () => void } = {}) {
  return (
    <>
      <div
        className="relative overflow-hidden rounded-b-[20px] px-3 pb-5 pt-2"
        style={{ background: 'linear-gradient(155deg, #10B981 0%, #059669 55%, #065F46 100%)' }}
      >
        <div className="pointer-events-none absolute -right-5 -top-7 h-16 w-16 rounded-full bg-white/10" />
        <div className="pointer-events-none absolute -bottom-5 -left-6 h-12 w-12 rounded-full bg-white/10" />
        <StatusRow />
        <button type="button" onClick={onBack} disabled={!onBack} className="mt-1.5 flex items-center gap-1.5">
          <ChevronLeft size={14} className="text-white" />
          <span className="text-[10px] font-bold text-white/85">Resumen del período</span>
        </button>
      </div>
      <div className="-mt-3 flex flex-1 flex-col gap-3 px-3 pb-2">
        <div className="rounded-xl border border-border bg-white px-3 py-3 text-center">
          <div className="flex items-center justify-center gap-1 text-[8px] font-bold text-muted-foreground">
            <TrendingUp size={10} /> Acumulado este período
          </div>
          <p className="mt-1 text-[19px] font-extrabold text-foreground">$687.200</p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full" style={{ width: '80%', background: GREEN }} />
          </div>
          <p className="mt-1 text-[7px] font-semibold text-muted-foreground">12 de 15 días del período</p>
        </div>
        <div className="flex gap-2">
          <MiniStat label="Horas" value="76h" />
          <MiniStat label="Extra" value="6h" color={VIOLET} />
          <MiniStat label="Festivos" value="1" color="#EB6834" />
        </div>
      </div>
    </>
  );
}

function EquipoScreen({
  onTabSelect,
  onOpenDetail,
}: {
  onTabSelect?: (t: Tab) => void;
  onOpenDetail?: (d: Detail) => void;
} = {}) {
  const equipo = [
    { i: 'CM', n: 'Carlos Martínez', rol: 'Cocina', c: 'Cocina · Activo', bg: '#FF5A3C' },
    { i: 'LR', n: 'Luisa Ramírez', rol: 'Salón', c: 'Salón · Activo', bg: BLUE },
    { i: 'PV', n: 'Pedro Vargas', rol: 'Domicilios', c: 'Domicilios · Activo', bg: GREEN },
    { i: 'AG', n: 'Ana Gómez', rol: 'Caja', c: 'Caja · Activo', bg: VIOLET },
  ];
  return (
    <>
      <div className="border-b border-border bg-white px-3 pb-2 pt-2">
        <StatusRow dark />
        <p className="mt-1 text-[13px] font-extrabold text-foreground">Equipo</p>
        <p className="text-[8px] font-semibold text-muted-foreground">8 activos</p>
      </div>
      <div className="flex flex-1 flex-col gap-2 px-3 py-2.5">
        <div className="flex items-center gap-1.5 rounded-lg border border-border bg-background px-2 py-1.5 text-[8px] font-semibold text-muted-foreground">
          <Search size={11} /> Buscar trabajador…
        </div>
        {equipo.map((t) => (
          <button
            key={t.i}
            type="button"
            disabled={!onOpenDetail}
            onClick={() => onOpenDetail?.({ kind: 'miembro', nombre: t.n, rol: t.rol, inicial: t.i, color: t.bg })}
            className="flex items-center gap-2 border-b border-border py-1.5 text-left last:border-0"
          >
            <div
              className="flex h-[22px] w-[22px] flex-shrink-0 items-center justify-center rounded-full text-[8px] font-extrabold text-white"
              style={{ background: t.bg }}
            >
              {t.i}
            </div>
            <div className="flex-1">
              <div className="text-[10px] font-bold text-foreground">{t.n}</div>
              <div className="text-[8px] font-semibold text-muted-foreground">{t.c}</div>
            </div>
            {onOpenDetail && <ChevronRight size={11} className="text-muted-foreground" />}
          </button>
        ))}
      </div>
      <TabBar active="equipo" accent={BLUE} onSelect={onTabSelect} />
    </>
  );
}

// ── Vistas de gestor (jefe de turnos / nómina-admin) ────────────────────
// Mismos tokens y componentes visuales que las pantallas de trabajador de
// arriba — solo cambian los datos y las acciones disponibles, igual que en
// la app real (ver Role Matrix en CLAUDE.md).

function GestorDashboardScreen({
  role,
  onTabSelect,
  onOpenDetail,
}: {
  role: Extract<Role, 'jefe_turnos' | 'nomina'>;
  onTabSelect?: (t: Tab) => void;
  onOpenDetail?: (d: Detail) => void;
}) {
  const isNomina = role === 'nomina';
  const stats = isNomina
    ? [
        { n: '5', l: 'Días restantes', c: 'text-foreground' },
        { n: '$5.2M', l: 'Por liquidar', c: 'text-info' },
        { n: '8', l: 'Empleados', c: 'text-success' },
      ]
    : [
        { n: '6', l: 'Turnos hoy', c: 'text-foreground' },
        { n: '2', l: 'Sin cubrir', c: 'text-danger' },
        { n: '8', l: 'Activos', c: 'text-success' },
      ];
  const actions = isNomina
    ? [
        { icon: WalletIcon, l: 'Liquidar', run: () => onTabSelect?.('nomina') },
        { icon: Users, l: 'Equipo', run: () => onTabSelect?.('equipo') },
        { icon: CalendarDays, l: 'Turnos', run: () => onTabSelect?.('turnos') },
      ]
    : [
        { icon: Plus, l: 'Nuevo turno', run: () => onOpenDetail?.({ kind: 'crear' }) },
        { icon: Users, l: 'Equipo', run: () => onTabSelect?.('equipo') },
        { icon: WalletIcon, l: 'Nómina', run: () => onTabSelect?.('nomina') },
      ];
  const nominaRows = [
    { i: 'CM', n: 'Carlos Martínez', rol: 'Cocina', meta: '76h acumuladas', v: '$687.200', bg: '#FF5A3C' },
    { i: 'LR', n: 'Luisa Ramírez', rol: 'Salón', meta: '80h acumuladas', v: '$742.100', bg: BLUE },
  ];
  const turnosRows = [
    { org: 'La Terraza', title: 'Turno de cocina', meta: '5 Ago · falta 1 plaza', cobertura: '2/3 plazas' },
    { org: 'Eventos BQ', title: 'Meseros · evento corporativo', meta: '8 Ago · faltan 2 plazas', cobertura: '0/2 plazas' },
  ];

  return (
    <>
      <div className="rounded-b-[22px] bg-primary px-4 pb-5 pt-2">
        <StatusRow />
        <p className="mt-1.5 text-[11px] font-semibold text-white/85">Buenos días</p>
        <div className="mt-1 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-[26px] w-[26px] items-center justify-center rounded-full bg-white/25 text-[10px] font-extrabold text-white">
              {isNomina ? 'MJ' : 'DR'}
            </div>
            <span className="text-base font-extrabold text-white">{isNomina ? 'María' : 'Diego'}</span>
          </div>
          <div className="relative flex h-[26px] w-[26px] items-center justify-center rounded-lg bg-white/20">
            <BellIcon size={13} className="text-white" />
          </div>
        </div>
        <p className="mt-0.5 text-[10px] font-semibold text-white/70">{isNomina ? 'Nómina · Admin' : 'Jefe de turnos'}</p>
      </div>

      <div className="-mt-3.5 flex flex-1 flex-col gap-2.5 px-3 pb-2.5">
        <div className="flex gap-2">
          {stats.map((s) => (
            <div key={s.l} className="flex-1 rounded-lg border border-border bg-white py-1.5 text-center">
              <div className={`text-[13px] font-extrabold tabular-nums ${s.c}`}>{s.n}</div>
              <div className="text-[7px] font-bold text-muted-foreground">{s.l}</div>
            </div>
          ))}
        </div>

        <div>
          <p className="mb-1.5 text-[10px] font-bold text-muted-foreground">Acciones rápidas</p>
          <div className="flex gap-2">
            {actions.map((a) => (
              <button
                key={a.l}
                type="button"
                onClick={a.run}
                className="flex flex-1 flex-col items-center gap-1 rounded-xl border border-border bg-white py-2"
              >
                <a.icon size={14} className="text-primary" />
                <span className="text-center text-[7px] font-bold text-foreground">{a.l}</span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-1 text-[10px] font-bold text-muted-foreground">
            {isNomina ? 'Acumulado del equipo' : 'Turnos por cubrir'}
          </p>
          {isNomina
            ? nominaRows.map((r) => (
                <button
                  key={r.i}
                  type="button"
                  onClick={() => onOpenDetail?.({ kind: 'miembro', nombre: r.n, rol: r.rol, inicial: r.i, color: r.bg })}
                  className="flex w-full items-center gap-2 border-b border-border py-1.5 text-left last:border-0"
                >
                  <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-success" />
                  <div className="flex-1">
                    <div className="text-[10px] font-bold text-foreground">{r.n}</div>
                    <div className="text-[8px] font-semibold text-muted-foreground">{r.meta}</div>
                  </div>
                  <span className="text-[9px] font-extrabold text-foreground">{r.v}</span>
                </button>
              ))
            : turnosRows.map((r) => (
                <button
                  key={r.org}
                  type="button"
                  onClick={() => onOpenDetail?.({ kind: 'turno', org: r.org, title: r.title, meta: r.meta, cobertura: r.cobertura })}
                  className="flex w-full items-center gap-2 border-b border-border py-1.5 text-left last:border-0"
                >
                  <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-danger" />
                  <div className="flex-1">
                    <div className="text-[10px] font-bold text-foreground">{r.title}</div>
                    <div className="text-[8px] font-semibold text-muted-foreground">{r.meta}</div>
                  </div>
                  <span className="text-[9px] font-extrabold text-foreground">{r.cobertura}</span>
                </button>
              ))}
        </div>
      </div>

      <TabBar active="inicio" accent={isNomina ? GREEN : undefined} onSelect={onTabSelect} />
    </>
  );
}

function GestorTurnosScreen({
  onTabSelect,
  onOpenDetail,
}: {
  onTabSelect?: (t: Tab) => void;
  onOpenDetail?: (d: Detail) => void;
}) {
  const turnos = [
    { org: 'La Terraza', title: 'Turno de cocina', meta: '5 Ago · 14:00–22:00', cobertura: '2/3', full: false },
    { org: 'Eventos BQ', title: 'Meseros · evento corporativo', meta: '8 Ago · 18:00–23:00', cobertura: '0/2', full: false },
    { org: 'Salón Andino', title: 'Seguridad · turno nocturno', meta: '9 Ago · 21:00–06:00', cobertura: '3/3', full: true },
  ];
  return (
    <>
      <div className="border-b border-border bg-white px-3 pb-2 pt-2">
        <StatusRow dark />
        <div className="mt-1 flex items-center justify-between">
          <p className="text-[13px] font-extrabold text-foreground">Turnos</p>
          <button
            type="button"
            onClick={() => onOpenDetail?.({ kind: 'crear' })}
            aria-label="Nuevo turno"
            className="flex h-6 w-6 items-center justify-center rounded-lg bg-primary text-white"
          >
            <Plus size={13} />
          </button>
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-2 px-3 py-2.5">
        {turnos.map((t) => (
          <button
            key={t.org}
            type="button"
            onClick={() =>
              onOpenDetail?.({ kind: 'turno', org: t.org, title: t.title, meta: t.meta, cobertura: `${t.cobertura} plazas` })
            }
            className="flex overflow-hidden rounded-xl border border-border bg-white text-left"
          >
            <div className="w-1" style={{ background: t.full ? GREEN : '#FF5A3C' }} />
            <div className="flex flex-1 flex-col gap-0.5 px-2.5 py-2">
              <span className="text-[8px] font-bold uppercase tracking-wide text-muted-foreground">{t.org}</span>
              <span className="text-[11px] font-extrabold text-foreground">{t.title}</span>
              <span className="text-[8px] font-semibold text-muted-foreground">{t.meta}</span>
              <span
                className="mt-0.5 w-fit rounded-full px-1.5 py-0.5 text-[7px] font-extrabold"
                style={{ background: t.full ? GREEN_LIGHT : ORANGE_LIGHT, color: t.full ? GREEN : '#FF5A3C' }}
              >
                {t.cobertura} plazas cubiertas
              </span>
            </div>
          </button>
        ))}
      </div>
      <TabBar active="turnos" onSelect={onTabSelect} />
    </>
  );
}

function NominaGestorScreen({
  onTabSelect,
  onOpenDetail,
}: {
  onTabSelect?: (t: Tab) => void;
  onOpenDetail?: (d: Detail) => void;
}) {
  const equipo = [
    { i: 'CM', n: 'Carlos Martínez', rol: 'Cocina', h: '76h', v: '$687.200', bg: '#FF5A3C' },
    { i: 'LR', n: 'Luisa Ramírez', rol: 'Salón', h: '80h', v: '$742.100', bg: BLUE },
    { i: 'PV', n: 'Pedro Vargas', rol: 'Domicilios', h: '68h', v: '$611.400', bg: GREEN },
  ];
  return (
    <>
      <div
        className="relative overflow-hidden rounded-b-[18px] px-3 pb-3 pt-2"
        style={{ background: 'linear-gradient(155deg, #10B981 0%, #059669 55%, #065F46 100%)' }}
      >
        <div className="pointer-events-none absolute -right-5 -top-7 h-16 w-16 rounded-full bg-white/10" />
        <div className="pointer-events-none absolute -bottom-5 -left-6 h-12 w-12 rounded-full bg-white/10" />
        <StatusRow />
        <p className="mt-1 text-[11px] font-semibold text-white/85">Nómina</p>
        <p className="text-[12px] font-extrabold text-white">Quincena 1–15 Ago</p>
      </div>
      <div className="-mt-2 flex flex-1 flex-col gap-2.5 px-3 pb-2">
        <div className="rounded-xl border border-border bg-white px-2.5 py-2">
          <p className="text-[8px] font-bold text-muted-foreground">Total a liquidar · 8 empleados</p>
          <p className="text-[15px] font-extrabold text-foreground">$5.180.300</p>
          <div className="mt-2 rounded-lg py-1.5 text-center text-[9px] font-extrabold text-white" style={{ background: GREEN }}>
            Liquidar período
          </div>
        </div>
        <p className="text-[10px] font-bold text-muted-foreground">Por empleado</p>
        {equipo.map((t) => (
          <button
            key={t.i}
            type="button"
            onClick={() => onOpenDetail?.({ kind: 'miembro', nombre: t.n, rol: t.rol, inicial: t.i, color: t.bg })}
            className="flex items-center gap-2 border-b border-border py-1.5 text-left last:border-0"
          >
            <div
              className="flex h-[22px] w-[22px] flex-shrink-0 items-center justify-center rounded-full text-[8px] font-extrabold text-white"
              style={{ background: t.bg }}
            >
              {t.i}
            </div>
            <div className="flex-1">
              <div className="text-[10px] font-bold text-foreground">{t.n}</div>
              <div className="text-[8px] font-semibold text-muted-foreground">{t.h} acumuladas</div>
            </div>
            <span className="text-[9px] font-extrabold text-foreground">{t.v}</span>
          </button>
        ))}
      </div>
      <TabBar active="nomina" accent={GREEN} onSelect={onTabSelect} />
    </>
  );
}

function MiembroDetalleScreen({
  miembro,
  onBack,
}: {
  miembro: Extract<Detail, { kind: 'miembro' }>;
  onBack?: () => void;
}) {
  return (
    <>
      <div className="border-b border-border bg-white px-3 pb-2 pt-2">
        <StatusRow dark />
        <button type="button" onClick={onBack} disabled={!onBack} className="mt-1 flex items-center gap-1.5">
          <ChevronLeft size={14} className="text-foreground" />
          <p className="text-[11px] font-extrabold text-foreground">Perfil</p>
        </button>
      </div>
      <div className="flex flex-1 flex-col items-center gap-3 px-4 py-5 text-center">
        <div
          className="flex h-14 w-14 items-center justify-center rounded-full text-[15px] font-extrabold text-white"
          style={{ background: miembro.color }}
        >
          {miembro.inicial}
        </div>
        <div>
          <p className="text-[13px] font-extrabold text-foreground">{miembro.nombre}</p>
          <p className="text-[9px] font-semibold text-muted-foreground">{miembro.rol} · Activo</p>
        </div>
        <div className="flex w-full gap-2">
          <MiniStat label="Horas mes" value="76h" />
          <MiniStat label="Acumulado" value="$687.200" color={GREEN} />
        </div>
        <div className="w-full rounded-lg border border-border py-2 text-center text-[9px] font-extrabold text-primary">
          Ver turnos asignados
        </div>
      </div>
    </>
  );
}
