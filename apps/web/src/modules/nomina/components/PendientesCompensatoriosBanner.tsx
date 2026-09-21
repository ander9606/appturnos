import { CalendarClock } from 'lucide-react';
import type { DescansoCompensatorio } from '../types';
import { fmtDiaSemana } from '@/shared/lib/format';
import { CLASIFICACION_BADGE, CLASIFICACION_LABEL } from '../constants';

export function PendientesCompensatoriosBanner({
  pendientes, onAsignar,
}: {
  pendientes: DescansoCompensatorio[];
  onAsignar: (c: DescansoCompensatorio) => void;
}) {
  if (pendientes.length === 0) return null;

  return (
    <div className="bg-warning-light border border-warning/30 rounded-xl p-4 mb-6">
      <div className="flex items-center gap-2 mb-3">
        <CalendarClock size={16} className="text-warning" />
        <p className="text-sm font-semibold text-foreground">
          {pendientes.length === 1
            ? '1 descanso compensatorio pendiente de asignar'
            : `${pendientes.length} descansos compensatorios pendientes de asignar`}
        </p>
      </div>
      <div className="flex flex-col gap-2">
        {pendientes.map(c => (
          <div key={c.id} className="flex items-center justify-between gap-3 bg-card rounded-lg px-3 py-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-sm text-foreground truncate">
                {c.trabajador_nombre} {c.trabajador_apellido}
              </span>
              <span className="text-xs text-muted-foreground shrink-0">
                · trabajó el {fmtDiaSemana(c.origen_fecha)}
              </span>
              <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium shrink-0 ${CLASIFICACION_BADGE[c.clasificacion]}`}>
                {CLASIFICACION_LABEL[c.clasificacion]}
              </span>
            </div>
            <button
              onClick={() => onAsignar(c)}
              className="shrink-0 bg-success hover:bg-success-600 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
            >
              Asignar fecha
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
