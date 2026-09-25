import { Utensils, Info } from 'lucide-react';
import type { Registro } from '../types';
import { fmtHrs } from '@/shared/lib/format';
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

/** Ícono inline con tooltip: por qué el día tuvo horas extra (tope semanal, no diario). */
export function ExtraIndicator({ r }: { r: Registro }) {
  const explicacion = explicarHorasExtra(r);
  if (!explicacion) return null;
  return (
    <Info size={12} className="text-muted-foreground/60 shrink-0">
      <title>
        {`Llevaba ${fmtHrs(explicacion.acumuladoSemana)}h esta semana → ${fmtHrs(explicacion.cupoUsado)}h de su cupo (${explicacion.topeSemanal}h) + ${fmtHrs(explicacion.horasExtra)}h extra`}
      </title>
    </Info>
  );
}
