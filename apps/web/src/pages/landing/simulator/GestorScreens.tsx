/**
 * Vistas de gestor (jefe de turnos / nómina-admin) — mismos tokens y
 * componentes visuales que las pantallas de trabajador de TrabajadorScreens,
 * solo cambian los datos y las acciones disponibles, igual que en la app
 * real (ver Role Matrix en CLAUDE.md).
 */
import { Bell as BellIcon, Wallet as WalletIcon, Users, CalendarDays, Plus, ChevronLeft } from 'lucide-react';
import { StatusRow, TabBar, MiniStat, GREEN, GREEN_LIGHT, ORANGE_LIGHT, BLUE } from './PhoneChrome';
import type { Tab, Detail, Role } from './types';

export function GestorDashboardScreen({
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

export function GestorTurnosScreen({
  onTabSelect,
  onOpenDetail,
}: {
  onTabSelect?: (t: Tab) => void;
  onOpenDetail?: (d: Detail) => void;
} = {}) {
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

export function NominaGestorScreen({
  onTabSelect,
  onOpenDetail,
}: {
  onTabSelect?: (t: Tab) => void;
  onOpenDetail?: (d: Detail) => void;
} = {}) {
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

export function MiembroDetalleScreen({
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
