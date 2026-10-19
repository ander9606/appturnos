import { useMemo, useState } from 'react';
import { Briefcase, Calendar } from 'lucide-react';
import { useAuthStore } from '@/modules/auth/authStore';
import { bogotaToday, fmtPeriodo } from '@/shared/lib/format';
import logoMark from '@/assets/logo-mark.png';
import { SeccionNomina } from '../components/SeccionNomina';
import { SeccionTurnos } from '../components/SeccionTurnos';
import { Orbitas } from '../components/ReportesUI';
import type { Rango } from '../types';

// ── Períodos ────────────────────────────────────────────────────────────

const sumarDias = (iso: string, n: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

function presets(hoy: string): { label: string; rango: Rango }[] {
  const [y, m] = hoy.split('-').map(Number);
  const pad = (n: number) => String(n).padStart(2, '0');
  const mesAnt = new Date(Date.UTC(y, m - 2, 1));
  const ultimoMesAnt = new Date(Date.UTC(y, m - 1, 0));
  return [
    { label: 'Este mes', rango: { desde: `${y}-${pad(m)}-01`, hasta: hoy } },
    { label: 'Mes pasado', rango: { desde: mesAnt.toISOString().slice(0, 10), hasta: ultimoMesAnt.toISOString().slice(0, 10) } },
    { label: 'Últimos 3 meses', rango: { desde: sumarDias(hoy, -90), hasta: hoy } },
  ];
}

const OTRO = -1;
const MAX_DIAS = 366; // el backend rechaza rangos mayores

// ── Página ──────────────────────────────────────────────────────────────

type Pestana = 'turnos' | 'nomina';

export function ReportesPage() {
  const rol = useAuthStore((s) => s.usuario?.rol);
  const verNomina = rol === 'admin_empresa' || rol === 'jefe_nomina' || rol === 'nomina';

  const hoy = bogotaToday();
  const lista = useMemo(() => presets(hoy), [hoy]);
  const [sel, setSel] = useState(0);
  const [otro, setOtro] = useState<Rango>({ desde: sumarDias(hoy, -30), hasta: hoy });
  const [pestana, setPestana] = useState<Pestana>('turnos');

  const rango = sel === OTRO ? otro : lista[sel].rango;
  const dias = (Date.parse(rango.hasta) - Date.parse(rango.desde)) / 86_400_000;
  const rangoValido = rango.desde <= rango.hasta && dias <= MAX_DIAS;

  const tabs = [
    { id: 'turnos' as const, label: 'Turnos', Icono: Calendar, acento: 'var(--color-primary)' },
    ...(verNomina ? [{ id: 'nomina' as const, label: 'Nómina', Icono: Briefcase, acento: 'var(--color-success)' }] : []),
  ];

  return (
    <div className="mx-auto max-w-6xl">
      {/* Encabezado de marca: degradado naranja, órbitas y el planeta del logo tenue */}
      <header
        className="relative overflow-hidden rounded-3xl p-6 text-white md:p-8"
        style={{ background: 'linear-gradient(180deg, var(--color-primary), var(--color-primary-600))' }}
      >
        <Orbitas className="-right-10 -top-8 text-white" anillos={3} />
        <img src={logoMark} alt="" aria-hidden="true" className="pointer-events-none absolute -right-8 -top-6 h-44 w-44 opacity-15" />
        <div className="relative">
          <p className="text-xs font-semibold uppercase tracking-widest">Reportes · Resumen de tu operación</p>
          <h1 className="mt-1 text-2xl font-extrabold md:text-3xl">{rangoValido ? fmtPeriodo(rango.desde, rango.hasta) : 'Revisa el período'}</h1>

          <div className="mt-5 flex flex-wrap items-center gap-2" role="group" aria-label="Período">
            {[...lista.map((p) => p.label), 'Otro rango'].map((label, i) => {
              const idx = i === lista.length ? OTRO : i;
              const activo = idx === sel;
              return (
                <button
                  key={label}
                  onClick={() => setSel(idx)}
                  aria-pressed={activo}
                  className={`rounded-xl px-4 py-2 text-sm font-bold transition-colors ${activo ? 'bg-white text-primary-700' : 'bg-white/20 text-white hover:bg-white/30'}`}
                >
                  {label}
                </button>
              );
            })}
            {sel === OTRO && (
              <div className="ml-1 flex items-center gap-2 text-sm font-semibold">
                <label className="flex items-center gap-1.5">Desde
                  <input type="date" value={otro.desde} max={otro.hasta} onChange={(e) => e.target.value && setOtro({ ...otro, desde: e.target.value })}
                    className="rounded-lg bg-white px-2 py-1.5 text-foreground" />
                </label>
                <label className="flex items-center gap-1.5">Hasta
                  <input type="date" value={otro.hasta} min={otro.desde} max={hoy} onChange={(e) => e.target.value && setOtro({ ...otro, hasta: e.target.value })}
                    className="rounded-lg bg-white px-2 py-1.5 text-foreground" />
                </label>
              </div>
            )}
          </div>
          {!rangoValido && (
            <p className="mt-3 rounded-lg bg-white/20 px-3 py-2 text-sm font-semibold">El período no puede superar {MAX_DIAS} días ni terminar antes de empezar.</p>
          )}
        </div>
      </header>

      {/* Turnos y nómina: dos análisis separados, nunca mezclados */}
      {tabs.length > 1 && (
        <div role="tablist" aria-label="Sección" className="mt-6 flex border-b border-border">
          {tabs.map(({ id, label, Icono, acento }) => {
            const activa = pestana === id;
            return (
              <button
                key={id}
                role="tab"
                aria-selected={activa}
                onClick={() => setPestana(id)}
                className={`-mb-px flex items-center gap-2 border-b-[3px] px-6 py-3 text-sm font-bold transition-colors ${activa ? 'text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                style={activa ? { borderBottomColor: acento } : undefined}
              >
                <Icono size={16} style={activa ? { color: acento } : undefined} aria-hidden="true" />{label}
              </button>
            );
          })}
        </div>
      )}

      <div className={tabs.length > 1 ? 'mt-6' : 'mt-8'} role="tabpanel">
        {rangoValido && (pestana === 'turnos' || !verNomina ? <SeccionTurnos rango={rango} /> : <SeccionNomina rango={rango} />)}
      </div>
    </div>
  );
}
