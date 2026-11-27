import { useState } from 'react';
import { puedeGestionarNomina } from '../permisos';
import { CalendarClock, ChevronDown, ChevronRight } from 'lucide-react';
import type { DescansoCompensatorio } from '../types';
import { fmtDiaSemana, bogotaToday } from '@/shared/lib/format';
import { CLASIFICACION_BADGE, CLASIFICACION_LABEL } from '../constants';
import { vencimientoCompensatorio, diasHasta, textoVencimiento, claseVencimiento } from '../utils';

/** Hasta cuántos pendientes se muestra la lista abierta; con más, llega plegada (empujaba las pestañas hacia abajo). */
const ABIERTO_HASTA = 3;

export function PendientesCompensatoriosBanner({
  pendientes, onAsignar,
}: {
  pendientes: DescansoCompensatorio[];
  onAsignar: (c: DescansoCompensatorio) => void;
}) {
  const [abiertoUsuario, setAbiertoUsuario] = useState<boolean | null>(null);
  if (pendientes.length === 0) return null;

  const abierto = abiertoUsuario ?? pendientes.length <= ABIERTO_HASTA;
  const puedeGestionar = puedeGestionarNomina();
  const masAntiguo = [...pendientes].sort((a, b) => a.origen_fecha.localeCompare(b.origen_fecha))[0];
  const dias = diasHasta(vencimientoCompensatorio(masAntiguo.origen_fecha), bogotaToday());

  return (
    <div className="bg-warning-light border border-warning/30 rounded-xl mb-6">
      <h3>
        <button
          onClick={() => setAbiertoUsuario(!abierto)}
          aria-expanded={abierto}
          aria-controls="pendientes-compensatorios"
          className="w-full flex items-center gap-2 p-4 text-left"
        >
          {abierto ? <ChevronDown size={16} className="text-warning-text shrink-0" /> : <ChevronRight size={16} className="text-warning-text shrink-0" />}
          <CalendarClock size={16} className="text-warning-text shrink-0" aria-hidden="true" />
          <span className="text-sm font-semibold text-foreground">
            {pendientes.length === 1
              ? '1 descanso compensatorio pendiente de asignar'
              : `${pendientes.length} descansos compensatorios pendientes de asignar`}
          </span>
          <span className={`ml-auto text-xs font-medium ${claseVencimiento(dias)}`}>
            {pendientes.length > 1 ? `El más antiguo: ${textoVencimiento(dias).toLowerCase()}` : textoVencimiento(dias)}
          </span>
        </button>
      </h3>
      {abierto && (
        <div id="pendientes-compensatorios" className="flex flex-col gap-2 px-4 pb-4">
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
              {puedeGestionar && (
                <button
                  onClick={() => onAsignar(c)}
                  className="shrink-0 bg-success-600 hover:bg-success-text text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
                >
                  Asignar fecha
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
