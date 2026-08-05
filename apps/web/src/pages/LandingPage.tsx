import { Link } from 'react-router';
import type { ReactNode } from 'react';
import {
  Calendar, MapPin, Wallet, Users, Bell, ShieldCheck,
  Bell as BellIcon, Search, Star, Lock, Mail, ChevronRight, Home,
  CalendarDays, Wallet as WalletIcon,
} from 'lucide-react';

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
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary">
            <Calendar size={16} className="text-white" />
          </div>
          <span className="text-base font-bold tracking-tight text-foreground">Zaturno</span>
        </div>
        <div className="flex items-center gap-2">
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
        <div>
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
        </div>

        <div className="flex justify-center lg:justify-end">
          <Phone>
            <DashboardScreen />
          </Phone>
        </div>
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
        {items.map((s) => (
          <div key={s.label} className="px-8 py-10 text-center">
            <div className="text-4xl font-extrabold tabular-nums tracking-tight text-white sm:text-5xl">
              {s.num}
            </div>
            <div className="mt-2 text-xs font-semibold uppercase tracking-wide text-white/60">
              {s.label}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ── Mockups gallery ──────────────────────────────────────────────────────

function Mockups() {
  return (
    <section id="app" className="px-6 py-20 sm:py-24">
      <div className="mx-auto max-w-3xl text-center">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">La app</p>
        <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-foreground text-balance sm:text-4xl">
          Pantallas reales, no bocetos
        </h2>
        <p className="mt-4 text-base leading-relaxed text-muted-foreground">
          Esto es exactamente lo que tu equipo ve al abrir zaturno — desde que inician sesión
          hasta que revisan su quincena.
        </p>
      </div>

      <div className="mx-auto mt-14 flex max-w-6xl flex-nowrap gap-7 overflow-x-auto px-1 pb-4 sm:flex-wrap sm:justify-center sm:overflow-visible">
        <MockupItem caption="Inicio de sesión">
          <Phone size="sm"><LoginScreen /></Phone>
        </MockupItem>
        <MockupItem caption="Mis turnos">
          <Phone size="sm"><TurnosScreen /></Phone>
        </MockupItem>
        <MockupItem caption="Nómina">
          <Phone size="sm"><NominaScreen /></Phone>
        </MockupItem>
        <MockupItem caption="Equipo">
          <Phone size="sm"><EquipoScreen /></Phone>
        </MockupItem>
      </div>
    </section>
  );
}

function MockupItem({ caption, children }: { caption: string; children: ReactNode }) {
  return (
    <div className="flex flex-shrink-0 flex-col items-center gap-3.5">
      {children}
      <span className="text-sm font-semibold text-muted-foreground">{caption}</span>
    </div>
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
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">El problema</p>
        <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
          ¿Te suena familiar?
        </h2>
      </div>
      <div className="mx-auto mt-14 grid max-w-6xl grid-cols-1 gap-px overflow-hidden rounded-2xl bg-border md:grid-cols-3">
        {items.map((p) => (
          <div key={p.q} className="border-t-[3px] border-warning bg-background px-7 py-9">
            <p className="text-base font-bold leading-snug text-foreground">{p.q}</p>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{p.a}</p>
          </div>
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
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">Cómo funciona</p>
        <h2 className="mt-3 max-w-lg text-3xl font-extrabold tracking-tight text-foreground text-balance sm:text-4xl">
          Del turno a la nómina, sin fricción
        </h2>

        <div className="mt-14 grid gap-16 lg:grid-cols-2">
          <div className="flex flex-col gap-9">
            {steps.map((s, i) => (
              <div key={s.title} className="flex gap-5">
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl border-2 border-primary text-sm font-extrabold text-primary">
                  {i + 1}
                </div>
                <div>
                  <h4 className="text-base font-bold text-foreground">{s.title}</h4>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
                </div>
              </div>
            ))}
          </div>

          <div>
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
          </div>
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
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">Funcionalidades</p>
        <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
          Todo lo que necesitas, nada que no
        </h2>
        <div className="mt-14 grid grid-cols-1 gap-px overflow-hidden rounded-2xl bg-border sm:grid-cols-2">
          {items.map(({ icon: Icon, title, body }) => (
            <div key={title} className="border-l-[3px] border-transparent bg-card px-8 py-9 transition-colors hover:border-primary">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-primary-50">
                <Icon size={20} className="text-primary" />
              </div>
              <h3 className="text-base font-bold text-foreground">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
            </div>
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
      <div className="mx-auto max-w-3xl text-center">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary-200">Industrias</p>
        <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-white text-balance sm:text-4xl">
          Con turnos rotativos o sin ellos, tu nómina queda al día
        </h2>
        <p className="mt-4 text-base leading-relaxed text-white/60">
          zaturno no es solo para negocios con turnos: es un sistema completo de nómina — también
          sirve para empresas con horario fijo que quieren automatizar sus recargos y liquidaciones.
        </p>
      </div>
      <div className="mx-auto mt-12 grid max-w-6xl grid-cols-1 gap-px sm:grid-cols-2 lg:grid-cols-5">
        {sectors.map((s) => (
          <div
            key={s.name}
            className="border border-white/10 bg-white/5 px-6 py-7 text-center transition-colors hover:bg-white/10"
          >
            <div className="text-sm font-bold text-white">{s.name}</div>
            <div className="mt-1.5 text-xs leading-relaxed text-white/50">{s.desc}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ── Final CTA ────────────────────────────────────────────────────────────

function FinalCta() {
  return (
    <section className="bg-card px-6 py-24 text-center">
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

function TabBar({ active, accent = '#FF5A3C' }: { active: 'inicio' | 'turnos' | 'nomina' | 'equipo'; accent?: string }) {
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
          <div key={t.key} className="flex flex-1 flex-col items-center gap-0.5" style={{ color: isActive ? accent : PLACEHOLDER }}>
            <t.icon size={13} />
            <span className="text-[7px] font-bold">{t.label}</span>
          </div>
        );
      })}
    </div>
  );
}

function DashboardScreen() {
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
        <div className="rounded-xl border bg-white px-3 py-2.5" style={{ borderColor: ORANGE_LIGHT }}>
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
        </div>

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
              { icon: CalendarDays, l: 'Mis Turnos' },
              { icon: WalletIcon, l: 'Quincena' },
              { icon: Star, l: 'Calificación' },
            ].map((a) => (
              <div key={a.l} className="flex flex-1 flex-col items-center gap-1 rounded-xl border border-border bg-white py-2">
                <a.icon size={14} className="text-primary" />
                <span className="text-center text-[7px] font-bold text-foreground">{a.l}</span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between">
            <span className="text-[10px] font-bold text-muted-foreground">Próximos turnos</span>
            <span className="text-[9px] font-bold text-primary">Ver todos</span>
          </div>
          {[
            { t: 'Evento corporativo', d: 'Vie 8 Ago · 6:00 p.m.' },
            { t: 'Turno nocturno', d: 'Sáb 9 Ago · 9:00 p.m.' },
          ].map((r) => (
            <div key={r.t} className="flex items-center gap-2 border-b border-border py-1.5 last:border-0">
              <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-info" />
              <div className="flex-1">
                <div className="text-[10px] font-bold text-foreground">{r.t}</div>
                <div className="text-[8px] font-semibold text-muted-foreground">{r.d}</div>
              </div>
              <ChevronRight size={11} className="text-muted-foreground" />
            </div>
          ))}
        </div>
      </div>

      <TabBar active="inicio" />
    </>
  );
}

function LoginScreen() {
  return (
    <>
      <div className="rounded-b-[26px] bg-primary pb-4 pt-2">
        <StatusRow />
        <div className="mt-2 flex flex-col items-center gap-1.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/35 bg-white/20">
            <span className="text-[13px] font-extrabold text-white">Z</span>
          </div>
          <p className="text-[13px] font-extrabold text-white">Zaturno</p>
          <p className="text-[8px] font-semibold text-white/75">Gestión de turnos y nómina</p>
        </div>
      </div>
      <div className="-mt-3 flex flex-1 flex-col gap-2 px-3 pb-2">
        <div className="flex flex-col gap-2 rounded-xl border border-border bg-white px-2.5 py-2">
          <p className="text-[10px] font-extrabold text-foreground">Inicia sesión</p>
          <div className="flex items-center gap-1.5 rounded-lg border border-border bg-background px-2 py-1.5 text-[8px] font-semibold text-muted-foreground">
            <Mail size={11} /> correo@empresa.com
          </div>
          <div className="flex items-center gap-1.5 rounded-lg border border-border bg-background px-2 py-1.5 text-[8px] font-semibold text-muted-foreground">
            <Lock size={11} /> ••••••••
          </div>
          <p className="text-right text-[8px] font-bold text-primary">¿Olvidaste tu contraseña?</p>
          <div className="rounded-lg bg-primary py-1.5 text-center text-[9px] font-extrabold text-white">
            Iniciar sesión
          </div>
        </div>
        <p className="text-center text-[8px] leading-relaxed text-muted-foreground">
          ¿Una empresa ya te invitó?
          <br />
          <span className="font-bold text-primary">Activa tu cuenta</span>
        </p>
      </div>
    </>
  );
}

function TurnosScreen() {
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
          { org: 'La Terraza', title: 'Turno de cocina', meta: '5 Ago · 14:00–22:00', tag: 'Confirmado', tagBg: GREEN_LIGHT, tagFg: GREEN, accent: '#FF5A3C' },
          { org: 'Eventos BQ', title: 'Meseros · evento corporativo', meta: '8 Ago · 18:00–23:00', tag: 'Pendiente', tagBg: BLUE_LIGHT, tagFg: BLUE, accent: BLUE },
        ].map((c) => (
          <div key={c.org} className="flex overflow-hidden rounded-xl border border-border bg-white">
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
          </div>
        ))}
      </div>
      <TabBar active="turnos" />
    </>
  );
}

function NominaScreen() {
  const registros = [
    { d: 'Lun 3 Ago', h: '6:58 a.m. – 3:02 p.m.', v: '8h 04' },
    { d: 'Mar 4 Ago', h: '6:55 a.m. – 3:00 p.m.', v: '8h 05' },
    { d: 'Mié 5 Ago', h: '9:58 p.m. – 6:03 a.m.', v: '8h 05 ★', highlight: true },
  ];
  return (
    <>
      <div className="rounded-b-[18px] px-3 pb-3 pt-2" style={{ background: GREEN }}>
        <StatusRow />
        <p className="mt-1 text-[11px] font-semibold text-white/85">Nómina</p>
        <p className="text-[12px] font-extrabold text-white">Quincena 1–15 Ago</p>
      </div>
      <div className="-mt-2 flex flex-1 flex-col gap-2.5 px-3 pb-2">
        <div className="rounded-xl border border-border bg-white px-2.5 py-2">
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
        </div>
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
      <TabBar active="nomina" accent={GREEN} />
    </>
  );
}

function EquipoScreen() {
  const equipo = [
    { i: 'CM', n: 'Carlos Martínez', c: 'Cocina · Activo', bg: '#FF5A3C' },
    { i: 'LR', n: 'Luisa Ramírez', c: 'Salón · Activo', bg: BLUE },
    { i: 'PV', n: 'Pedro Vargas', c: 'Domicilios · Activo', bg: GREEN },
    { i: 'AG', n: 'Ana Gómez', c: 'Caja · Activo', bg: VIOLET },
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
          <div key={t.i} className="flex items-center gap-2 border-b border-border py-1.5 last:border-0">
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
            <ChevronRight size={11} className="text-muted-foreground" />
          </div>
        ))}
      </div>
      <TabBar active="equipo" accent={BLUE} />
    </>
  );
}
