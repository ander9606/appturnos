import { fmtCOP } from '@/shared/lib/format';
import { useOpcionesGrupos } from '@/modules/configuracion/hooks/useConfiguracion';
import { useReporteGrupos } from '../hooks/useReportes';
import type { GrupoReporte, Rango } from '../types';
import { Titulo } from './ReportesUI';

const MAX_FILAS = 10;

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

function FilaGrupo({ g, max }: { g: GrupoReporte; max: number }) {
  return (
    <div className="border-t border-border px-5 py-3">
      <div className="flex items-center gap-3 text-sm">
        <span className="flex-1 truncate font-semibold text-foreground">{g.nombre}</span>
        <span className="text-xs text-muted-foreground">
          {[
            plural(g.turnos, 'turno', 'turnos'),
            plural(g.completados, 'completado', 'completados'),
            g.no_presentados ? plural(g.no_presentados, 'ausencia', 'ausencias') : null,
            g.plazas ? `${g.cubiertas} de ${g.plazas} plazas` : null,
          ].filter(Boolean).join(' · ')}
        </span>
        <span className="w-28 text-right font-semibold text-foreground">{fmtCOP(g.costo)}</span>
      </div>
      <div className="mt-1.5 h-1.5 rounded-full bg-primary/10">
        <div className="h-1.5 rounded-full bg-primary" style={{ width: `${max ? (g.costo / max) * 100 : 0}%` }} />
      </div>
      {g.pct != null && <p className="mt-1 text-xs text-muted-foreground">{g.pct.toLocaleString('es-CO')} % del costo de turnos</p>}
    </div>
  );
}

/**
 * Comparación de los grupos (eventos, obras…) con turnos en el período: cuánto cuesta cada uno y cuánto pesa en el
 * costo de turnos. Usa el nombre que la empresa le puso a los grupos; no se muestra si no los usa o no hay ninguno.
 */
export function PorGrupo({ rango }: { rango: Rango }) {
  const { usa, etiqueta } = useOpcionesGrupos();
  const q = useReporteGrupos(rango, usa);
  if (!usa || !q.data || !q.data.grupos.length) return null;

  const { grupos, sin_grupo } = q.data;
  const visibles = grupos.slice(0, MAX_FILAS);
  const max = Math.max(...grupos.map((g) => g.costo), 0);
  return (
    <section aria-label={`Costo por ${etiqueta.toLowerCase()}`}>
      <Titulo>{`Costo por ${etiqueta.toLowerCase()}`}</Titulo>
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <p className="px-5 py-3 text-xs text-muted-foreground">
          {plural(grupos.length, 'grupo con turnos', 'grupos con turnos')} en este período, del que más costó al que menos.
        </p>
        {visibles.map((g) => <FilaGrupo key={g.grupo_id} g={g} max={max} />)}
        {grupos.length > visibles.length && (
          <p className="border-t border-border px-5 py-2.5 text-xs text-muted-foreground">+{grupos.length - visibles.length} más</p>
        )}
        {sin_grupo.costo > 0 && (
          <div className="flex items-center border-t border-border bg-muted px-5 py-3 text-xs">
            <span className="flex-1 text-muted-foreground">Turnos sin {etiqueta.toLowerCase()}</span>
            <span className="font-semibold text-foreground">{fmtCOP(sin_grupo.costo)}</span>
          </div>
        )}
      </div>
    </section>
  );
}
