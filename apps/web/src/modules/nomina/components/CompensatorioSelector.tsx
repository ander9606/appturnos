import { useEffect, useMemo } from 'react';
import { AlertCircle } from 'lucide-react';
import { useCompensatorios } from '../hooks/useNomina';
import type { DescansoCompensatorio } from '../types';
import { compensatoriosDisponibles, vencimientoCompensatorio } from '../utils';
import { fmtDiaSemana } from '@/shared/lib/format';
import { CLASIFICACION_BADGE, CLASIFICACION_LABEL } from '../constants';

/**
 * Al marcar un día como «Compensatorio» el gestor elige cuál de los descansos pendientes del trabajador se
 * descuenta. Solo ofrece los que se pueden tomar ese día (ventana de 28 días) y deja el más antiguo
 * preseleccionado. El backend vuelve a validarlo: es quien decide de verdad.
 */
export function CompensatorioSelector({ trabajadorId, fecha, value, onChange }: {
  /** 0 mientras no se ha elegido trabajador. */
  trabajadorId: number;
  /** Día que se marca (YYYY-MM-DD); '' mientras no se ha elegido. */
  fecha: string;
  value: number | null;
  onChange: (id: number | null) => void;
}) {
  const { data, isLoading } = useCompensatorios();
  const todos = useMemo<DescansoCompensatorio[]>(() => data?.data ?? [], [data]);
  const listos = trabajadorId > 0 && fecha !== '';
  const disponibles = useMemo(
    () => (listos ? compensatoriosDisponibles(todos, trabajadorId, fecha) : []),
    [listos, todos, trabajadorId, fecha],
  );

  // El más antiguo queda preseleccionado; si cambia la fecha y el elegido ya no sirve, vuelve al más antiguo.
  useEffect(() => {
    const id = disponibles.some(c => c.id === value) ? value : disponibles[0]?.id ?? null;
    if (id !== value) onChange(id);
  }, [disponibles, value, onChange]);

  return (
    <fieldset>
      <legend className="block text-sm font-medium text-foreground mb-1">Compensatorio a descontar *</legend>
      {!listos ? (
        <p className="text-xs text-muted-foreground">Elige el trabajador y la fecha para ver sus compensatorios pendientes.</p>
      ) : isLoading ? (
        <p className="text-xs text-muted-foreground">Buscando compensatorios pendientes…</p>
      ) : disponibles.length === 0 ? (
        <div className="flex items-start gap-2 rounded-lg px-3 py-2.5 text-xs bg-warning-light text-warning">
          <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
          El trabajador no tiene compensatorios pendientes que se puedan tomar el {fmtDiaSemana(fecha)}.
          Si es un descanso sin compensatorio, usa el tipo «Descanso».
        </div>
      ) : (
        <div className="border border-border rounded-lg divide-y divide-border overflow-hidden">
          {disponibles.map((c, i) => (
            <label key={c.id} className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-muted/50">
              <input
                type="radio"
                name="compensatorio"
                checked={c.id === value}
                onChange={() => onChange(c.id)}
                className="accent-success"
              />
              <span className="flex-1 min-w-0">
                <span className="block text-sm text-foreground">
                  Trabajó el {fmtDiaSemana(c.origen_fecha)}{i === 0 && <span className="text-muted-foreground"> · el más antiguo</span>}
                </span>
                <span className="block text-xs text-muted-foreground">Vence el {fmtDiaSemana(vencimientoCompensatorio(c.origen_fecha))}</span>
              </span>
              <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium whitespace-nowrap ${CLASIFICACION_BADGE[c.clasificacion]}`}>
                {CLASIFICACION_LABEL[c.clasificacion]}
              </span>
            </label>
          ))}
        </div>
      )}
    </fieldset>
  );
}
