import {
  MapPin, Bell as BellIcon, ChevronRight, CalendarDays, Wallet as WalletIcon, Star,
  Briefcase, Minus, Plus, ChevronLeft, CheckCircle2, Crosshair, TrendingUp, Search,
} from 'lucide-react';
import { StatusRow, TabBar, MiniStat, GREEN, GREEN_LIGHT, ORANGE_LIGHT, BLUE, BLUE_LIGHT, VIOLET, AQUA, PLACEHOLDER } from './PhoneChrome';
import type { Tab, Detail } from './types';

export function DashboardScreen({
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

export function TurnosScreen({
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

export function CrearTurnoScreen({ onBack }: { onBack?: () => void } = {}) {
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

export function MarcarIngresoScreen({ onBack }: { onBack?: () => void } = {}) {
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

export function OfertaDetalleScreen({
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

export function NominaScreen({
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

export function AcumuladoScreen({ onBack }: { onBack?: () => void } = {}) {
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

export function EquipoScreen({
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
