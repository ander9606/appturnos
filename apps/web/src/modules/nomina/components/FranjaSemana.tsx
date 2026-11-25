import { BedDouble } from 'lucide-react';
import { diasSemanaEnPeriodo, tramosContiguos, type ZonaDia } from '../utils';
import { fmtDiaSemana, fmtHrs } from '@/shared/lib/format';

function etiqueta(zona: ZonaDia, horas?: number): string {
  const h = horas !== undefined && horas > 0 ? ` · ${fmtHrs(horas)}h` : '';
  return zona === 'este' ? `Este período${h}` : zona === 'anterior' ? `Anterior${h}` : 'Siguiente';
}

/**
 * Los 7 días de una semana (lun–dom) como celdas: lo que cae dentro del período en color, lo de fuera (período anterior
 * o siguiente) atenuado, y debajo una etiqueta corta por tramo. Reemplaza las líneas "Período anterior · rango · horas /
 * Este período · … / Período siguiente · …". El día de un compensatorio lleva una cama. Espejo de mobile (FranjaSemana.tsx).
 */
export function FranjaSemana({ lunes, periodoInicio, periodoFin, horasAnterior, horasEste, fechasCompensatorio = [] }: {
  lunes: string;
  periodoInicio: string;
  periodoFin: string;
  horasAnterior?: number;
  horasEste?: number;
  fechasCompensatorio?: string[];
}) {
  const dias = diasSemanaEnPeriodo(lunes, periodoInicio, periodoFin);
  const tramos = tramosContiguos(dias);
  const resumen = tramos
    .map(t => `${t.n} ${t.n === 1 ? 'día' : 'días'} ${t.zona === 'este' ? 'de este período' : t.zona === 'anterior' ? 'del período anterior' : 'del período siguiente'}`)
    .join(', ');

  return (
    <div
      role="img"
      aria-label={`Semana del ${fmtDiaSemana(lunes)}: ${resumen}${fechasCompensatorio.length ? `. Descanso compensatorio el ${fechasCompensatorio.map(fmtDiaSemana).join(' y ')}` : ''}`}
    >
      <div className="flex">
        {dias.map(d => {
          const dentro = d.zona === 'este';
          return (
            <div
              key={d.fecha}
              className={`flex-1 h-7 mx-0.5 rounded-md flex items-center justify-center text-[11px] ${dentro ? 'bg-success-light font-semibold text-foreground' : 'bg-muted text-muted-foreground'}`}
            >
              {fechasCompensatorio.includes(d.fecha) ? <BedDouble size={14} className="text-info" /> : Number(d.fecha.slice(8))}
            </div>
          );
        })}
      </div>
      <div className="flex mt-1">
        {tramos.map((t, i) => (
          <div key={i} style={{ flex: t.n }} className="px-0.5 min-w-0">
            <div className={`h-0.5 rounded-full mb-0.5 ${t.zona === 'este' ? 'bg-success' : 'bg-border'}`} />
            <p className={`text-[10px] truncate ${t.zona === 'este' ? 'font-medium text-foreground' : 'text-muted-foreground'}`}>
              {etiqueta(t.zona, t.zona === 'este' ? horasEste : t.zona === 'anterior' ? horasAnterior : undefined)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
