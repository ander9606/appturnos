import { Fragment } from 'react';
import { Check, Lock, LockOpen, CircleCheck } from 'lucide-react';
import type { EstadoPeriodo } from '../types';

const PASOS: { estado: EstadoPeriodo; label: string; Icono: typeof Lock }[] = [
  { estado: 'abierto',   label: 'Abierto',   Icono: LockOpen },
  { estado: 'cerrado',   label: 'Cerrado',   Icono: Lock },
  { estado: 'liquidado', label: 'Liquidado', Icono: CircleCheck },
];

/**
 * Dónde está el período en su ciclo: Abierto → Cerrado → Liquidado. El paso actual se ve de un vistazo y los
 * anteriores quedan marcados como hechos; reemplaza un badge que solo decía el nombre del estado. Espejo de mobile
 * (PeriodoPasos.tsx).
 */
export function PeriodoPasos({ estado }: { estado: EstadoPeriodo }) {
  const actual = Math.max(0, PASOS.findIndex(p => p.estado === estado));
  return (
    <ol
      className="flex items-start"
      aria-label={`Período ${PASOS[actual].label.toLowerCase()}, paso ${actual + 1} de ${PASOS.length}`}
    >
      {PASOS.map(({ estado: e, label, Icono }, i) => {
        const alcanzado = i <= actual;
        return (
          <Fragment key={e}>
            {i > 0 && <li aria-hidden="true" className={`h-0.5 w-8 mt-3.5 ${i <= actual ? 'bg-success' : 'bg-border'}`} />}
            <li className="flex flex-col items-center gap-1 w-16" aria-current={i === actual ? 'step' : undefined}>
              <span className={`w-7 h-7 rounded-full flex items-center justify-center ${alcanzado ? 'bg-success text-white' : 'bg-muted text-muted-foreground'}`}>
                {i < actual ? <Check size={15} /> : <Icono size={15} />}
              </span>
              <span className={`text-[11px] ${i === actual ? 'font-bold text-foreground' : 'text-muted-foreground'}`}>{label}</span>
            </li>
          </Fragment>
        );
      })}
    </ol>
  );
}
