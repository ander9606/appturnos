import { AlertCircle, AlertTriangle, ArrowDown, ArrowUp, CheckCircle2, Info, Minus } from 'lucide-react';
import type { CostoComparado, Insight, Jornadas, NivelInsight, Rango } from '../types';
import { fmtCOP, fmtDate } from '@/shared/lib/format';

/** Piezas de marca de Reportes (mismo lenguaje que la móvil): órbitas, anillo de progreso, avisos con ícono. */

export const nombreDe = (p: { nombre: string; apellido: string | null }) => `${p.nombre}${p.apellido ? ` ${p.apellido}` : ''}`;
export const horasTxt = (h: number) => `${h.toLocaleString('es-CO', { maximumFractionDigits: 1 })} h`;

/** Órbitas finas para la esquina de una tarjeta o del encabezado; el color sale de `currentColor`. */
export function Orbitas({ className = '', anillos = 2 }: { className?: string; anillos?: number }) {
  const lista = [{ rx: 96, ry: 34, o: 0.16 }, { rx: 140, ry: 50, o: 0.1 }, { rx: 190, ry: 68, o: 0.06 }].slice(0, anillos);
  return (
    <svg aria-hidden="true" className={`pointer-events-none absolute ${className}`} width="320" height="170" viewBox="0 0 320 170" fill="none">
      {lista.map((e) => (
        <ellipse key={e.rx} cx="220" cy="60" rx={e.rx} ry={e.ry} transform="rotate(25 220 60)" stroke="currentColor" strokeOpacity={e.o} strokeWidth="1.5" />
      ))}
      <circle cx="220" cy="60" r="12" fill="currentColor" fillOpacity=".16" />
    </svg>
  );
}

/** Anillo de progreso (el anillo del planeta); el valor va siempre escrito al centro. */
export function Anillo({ pct, color, size = 88, trazo = 9 }: { pct: number; color: string; size?: number; trazo?: number }) {
  const r = (size - trazo) / 2;
  const c = 2 * Math.PI * r;
  const lleno = Math.max(0, Math.min(100, pct)) / 100;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={`${Math.round(pct)} por ciento`}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeOpacity=".15" strokeWidth={trazo} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={trazo} strokeLinecap="round"
          strokeDasharray={`${c * lleno} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-lg font-bold text-foreground">{Math.round(pct)}%</span>
    </div>
  );
}

const NIVEL: Record<NivelInsight, { Icono: typeof Info; fondo: string; texto: string; icono: string }> = {
  alerta: { Icono: AlertCircle,   fondo: 'bg-danger-light',  texto: 'text-danger-text',  icono: 'text-danger' },
  aviso:  { Icono: AlertTriangle, fondo: 'bg-warning-light', texto: 'text-warning-text', icono: 'text-warning' },
  info:   { Icono: Info,          fondo: 'bg-info-light',    texto: 'text-info-text',    icono: 'text-info' },
  ok:     { Icono: CheckCircle2,  fondo: 'bg-success-light', texto: 'text-success-text', icono: 'text-success' },
};

/** Aviso con ícono + texto + color (el color solo no basta para ser accesible). */
export function AvisoInsight({ nivel, texto }: { nivel: NivelInsight; texto: string }) {
  const n = NIVEL[nivel];
  return (
    <div className={`flex items-start gap-3 rounded-2xl p-4 ${n.fondo}`}>
      <n.Icono size={20} className={`mt-0.5 shrink-0 ${n.icono}`} aria-hidden="true" />
      <p className={`text-sm ${n.texto}`}>{texto}</p>
    </div>
  );
}

/** Los avisos reales van primero; "todo en orden" solo si no hay ninguno. */
export function ParaMirar({ insights }: { insights: Insight[] }) {
  const reales = insights.filter((i) => i.nivel !== 'ok');
  const lista = reales.length ? reales : insights.slice(0, 1);
  if (!lista.length) return null;
  return (
    <section>
      <Titulo>Para mirar</Titulo>
      <div className="grid gap-3 md:grid-cols-2">{lista.map((i) => <AvisoInsight key={i.id} nivel={i.nivel} texto={i.texto} />)}</div>
    </section>
  );
}

export function Titulo({ children }: { children: string }) {
  return <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">{children}</h3>;
}

/** Sube = malo (cuesta más), baja = bueno, igual = informativo. */
function Delta({ pct }: { pct: number | null }) {
  if (pct == null) return <span className="text-xs text-muted-foreground">Sin período anterior para comparar</span>;
  const plano = Math.abs(pct) < 0.5;
  const sube = pct > 0;
  const estilo = plano ? 'bg-info-light text-info-text' : sube ? 'bg-warning-light text-warning-text' : 'bg-success-light text-success-text';
  const Icono = plano ? Minus : sube ? ArrowUp : ArrowDown;
  const texto = plano ? 'Sin cambio' : `${Math.abs(Math.round(pct))}%`;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${estilo}`}
      aria-label={`${plano ? 'Sin cambio' : `${sube ? 'Subió' : 'Bajó'} ${Math.abs(Math.round(pct))} por ciento`} frente al período anterior`}>
      <Icono size={12} aria-hidden="true" />{texto}
    </span>
  );
}

export interface Concepto { label: string; valor: number; color: string }

/** Costo de UN lado contra su propio período anterior, con su desglose en una barra apilada. */
export function TarjetaCosto({ titulo, costo, previo, items, acento }: {
  titulo: string; costo: CostoComparado; previo: Rango; items: Concepto[]; acento: string;
}) {
  const lista = items.filter((c) => c.valor > 0);
  const total = lista.reduce((s, c) => s + c.valor, 0);
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-6" style={{ color: acento }}>
      <Orbitas className="-right-16 -top-10" />
      <div className="relative text-foreground">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{titulo}</p>
        <p className="mt-1 text-4xl font-extrabold">{fmtCOP(costo.total)}</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Delta pct={costo.delta_pct} />
          {costo.delta_pct != null && (
            <span className="text-xs text-muted-foreground">vs {fmtCOP(costo.previo)} en {fmtDate(previo.desde)} – {fmtDate(previo.hasta)}</span>
          )}
        </div>
        {total > 0 && (
          <div className="mt-5 space-y-3">
            <div className="flex h-2.5 overflow-hidden rounded-full bg-muted">
              {lista.map((c) => <div key={c.label} style={{ flex: c.valor, backgroundColor: c.color }} />)}
            </div>
            {lista.map((c) => (
              <div key={c.label} className="flex items-center gap-2 text-sm">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: c.color }} />
                <span className="flex-1">{c.label}</span>
                <span className="font-semibold">{fmtCOP(c.valor)}</span>
                <span className="w-10 text-right text-xs text-muted-foreground">{Math.round((c.valor / total) * 100)}%</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function Mini({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground">{sub}</p>
    </div>
  );
}

/** Promedio, la más larga y la más corta (nómina: por día trabajado · turnos: por turno completado). */
export function TarjetasJornada({ titulo, j, apiladas = false }: { titulo: string; j: Jornadas | null; apiladas?: boolean }) {
  if (!j) return null;
  const extremo = (label: string, e: typeof j.mas_larga) => (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold text-foreground">{e ? horasTxt(e.horas) : '—'}</p>
      {e && <p className="text-xs text-foreground">{nombreDe(e)}</p>}
      {e && <p className="text-xs text-muted-foreground">{fmtDate(e.fecha)}</p>}
    </div>
  );
  return (
    <section>
      <Titulo>{titulo}</Titulo>
      <div className={`grid gap-3 ${apiladas ? '' : 'sm:grid-cols-3'}`}>
        <Mini label="Promedio" value={horasTxt(j.promedio)} sub={`${j.jornadas.toLocaleString('es-CO')} jornadas`} />
        {extremo('Más larga', j.mas_larga)}
        {extremo('Más corta', j.mas_corta)}
      </div>
    </section>
  );
}
