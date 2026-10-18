import { useEffect, useState } from 'react';
import { Utensils, Info, Radio } from 'lucide-react';
import type { Registro } from '../types';
import { fmtHrs, fmtDiaSemana } from '@/shared/lib/format';
import { minutosAlmuerzoDescontados, esJornadaLarga, fmtDuracionMin, explicarHorasExtra } from '../utils';

/** Ícono inline con tooltip: por qué el total del día no coincide con entrada→salida. */
export function AlmuerzoIndicator({ r }: { r: Registro }) {
  const minutos = minutosAlmuerzoDescontados(r);
  if (minutos > 0) {
    return (
      <Utensils size={12} className="text-muted-foreground/60 shrink-0">
        <title>{`Se descontó ${fmtDuracionMin(minutos)} de almuerzo automáticamente (jornada > 6h)`}</title>
      </Utensils>
    );
  }
  if (r.jornada_continua === 1 && esJornadaLarga(r)) {
    return (
      <Utensils size={12} className="text-success shrink-0">
        <title>Jornada continua: el trabajador marcó que no tomó almuerzo — sin descuento</title>
      </Utensils>
    );
  }
  return null;
}

/** Ícono inline con tooltip: el turno sigue abierto — las horas mostradas son una proyección en vivo, no el cierre real. */
export function EnVivoIndicator({ r }: { r: Registro }) {
  if (!r.en_vivo) return null;
  return (
    <Radio size={12} className="text-success shrink-0 animate-pulse">
      <title>En curso — horas estimadas hasta que marque salida</title>
    </Radio>
  );
}

/**
 * Ícono ⓘ que abre un popover con el porqué de las horas extra (tope semanal, no diario).
 * El popover es `fixed` para que la tabla con scroll no lo recorte, y se cierra al perder foco o hacer scroll.
 * `periodoInicio`: si el lunes de la semana cae antes, se avisa que las horas previas son del período anterior.
 */
export function ExtraIndicator({ r, periodoInicio }: { r: Registro; periodoInicio?: string }) {
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
  useEffect(() => {
    if (!pos) return;
    const cerrar = () => setPos(null);
    window.addEventListener('scroll', cerrar, true);
    window.addEventListener('resize', cerrar);
    return () => { window.removeEventListener('scroll', cerrar, true); window.removeEventListener('resize', cerrar); };
  }, [pos]);

  const e = explicarHorasExtra(r);
  if (!e) return null;
  const deOtroPeriodo = !!periodoInicio && e.lunesSemana < periodoInicio;

  return (
    <>
      <button
        type="button"
        aria-label="Por qué hay horas extra"
        aria-expanded={!!pos}
        onClick={(ev) => {
          const rect = ev.currentTarget.getBoundingClientRect();
          setPos(pos ? null : { top: rect.bottom + 6, right: window.innerWidth - rect.right });
        }}
        onBlur={() => setPos(null)}
        className="inline-flex align-middle text-muted-foreground/60 hover:text-muted-foreground"
      >
        <Info size={12} />
      </button>
      {pos && (
        <div
          role="note"
          style={{ position: 'fixed', top: pos.top, right: pos.right }}
          className="z-50 w-56 rounded-lg border border-border bg-card p-3 text-left text-xs text-foreground shadow-lg space-y-1"
        >
          <p>Semana del {fmtDiaSemana(e.lunesSemana).toLowerCase()}</p>
          <p>Antes de hoy: {fmtHrs(e.acumuladoSemana)} h de {e.topeSemanal}</p>
          <p>Hoy: {fmtHrs(e.cupoUsado)} h de cupo + {fmtHrs(e.horasExtra)} h extra</p>
          {deOtroPeriodo && <p className="text-muted-foreground">Las horas previas son del período anterior.</p>}
        </div>
      )}
    </>
  );
}
