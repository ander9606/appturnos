import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useAuthStore } from '@/modules/auth/authStore';
import { useOfertas } from '@/modules/turnos/hooks/useTurnos';
import { usePeriodos } from '@/modules/nomina/hooks/useNomina';
import { MonthCalendar } from '@/shared/components/MonthCalendar';
import { getMonthGrid, type CalendarDay } from '@/shared/lib/calendar';
import { fmtDate, bogotaToday } from '@/shared/lib/format';
import type { Oferta, EstadoOferta } from '@/modules/turnos/types';
import type { Periodo, EstadoPeriodo } from '@/modules/nomina/types';

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

const ESTADO_OFERTA_DOT: Record<EstadoOferta, string> = {
  borrador: 'bg-muted-foreground/40',
  abierta: 'bg-primary-400',
  publicada: 'bg-primary-400',
  en_proceso: 'bg-warning',
  completada: 'bg-success',
  cerrada: 'bg-muted-foreground/40',
  cancelada: 'bg-danger',
};

const ESTADO_PERIODO_BG: Record<EstadoPeriodo, string> = {
  abierto: 'bg-success-light',
  cerrado: 'bg-warning-light',
  liquidado: 'bg-primary-100',
};

export function CalendarioPage() {
  const navigate = useNavigate();
  const rol = useAuthStore(s => s.usuario?.rol);
  const showTurnos = rol === 'admin_empresa' || rol === 'jefe_turnos';
  const showNomina = rol === 'admin_empresa' || rol === 'jefe_nomina' || rol === 'nomina';

  const [modo, setModo] = useState<'turnos' | 'nomina'>(showTurnos ? 'turnos' : 'nomina');
  const [cursor, setCursor] = useState(() => {
    const [y, m] = bogotaToday().split('-').map(Number);
    return { year: y, month: m };
  });
  const [diaSeleccionado, setDiaSeleccionado] = useState<string | null>(null);

  const weeks = useMemo(() => getMonthGrid(cursor.year, cursor.month), [cursor]);
  const primerDia = weeks[0][0].date;
  const ultimoDia = weeks[weeks.length - 1][6].date;

  const { data: ofertasData, isLoading: loadingOfertas } = useOfertas(
    { fecha_desde: primerDia, fecha_hasta: ultimoDia, limit: 200 },
    { enabled: modo === 'turnos' },
  );
  const ofertas: Oferta[] = ofertasData?.data?.data ?? [];
  const ofertasPorDia = useMemo(() => {
    const map = new Map<string, Oferta[]>();
    for (const o of ofertas) {
      const lista = map.get(o.fecha) ?? [];
      lista.push(o);
      map.set(o.fecha, lista);
    }
    return map;
  }, [ofertas]);

  const { data: periodosData, isLoading: loadingPeriodos } = usePeriodos(undefined, false, {
    enabled: modo === 'nomina',
    fechaDesde: primerDia,
    fechaHasta: ultimoDia,
  });
  const periodos: Periodo[] = periodosData?.data?.data ?? [];
  const periodoDeDia = (fecha: string) => periodos.find(p => p.fecha_inicio <= fecha && fecha <= p.fecha_fin);

  const cambiarMes = (delta: number) => {
    setDiaSeleccionado(null);
    setCursor(c => {
      const m = c.month + delta;
      if (m < 1) return { year: c.year - 1, month: 12 };
      if (m > 12) return { year: c.year + 1, month: 1 };
      return { year: c.year, month: m };
    });
  };

  const irAHoy = () => {
    const [y, m] = bogotaToday().split('-').map(Number);
    setCursor({ year: y, month: m });
    setDiaSeleccionado(null);
  };

  const ofertasDelDiaSeleccionado = diaSeleccionado ? ofertasPorDia.get(diaSeleccionado) ?? [] : [];
  const periodoDelDiaSeleccionado = diaSeleccionado ? periodoDeDia(diaSeleccionado) : undefined;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-foreground">Calendario</h1>
        {showTurnos && showNomina && (
          <div className="flex gap-1 border-b border-border">
            {([{ value: 'turnos' as const, label: 'Turnos' }, { value: 'nomina' as const, label: 'Nómina' }]).map(t => (
              <button
                key={t.value}
                onClick={() => { setModo(t.value); setDiaSeleccionado(null); }}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  modo === t.value
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={() => cambiarMes(-1)}
          className="w-8 h-8 flex items-center justify-center rounded-lg border border-border hover:bg-muted transition-colors"
        >
          <ChevronLeft size={16} />
        </button>
        <p className="text-sm font-semibold text-foreground min-w-36 text-center">{MESES[cursor.month - 1]} {cursor.year}</p>
        <button
          onClick={() => cambiarMes(1)}
          className="w-8 h-8 flex items-center justify-center rounded-lg border border-border hover:bg-muted transition-colors"
        >
          <ChevronRight size={16} />
        </button>
        <button
          onClick={irAHoy}
          className="text-xs font-medium text-primary hover:text-primary-600 border border-border rounded-lg px-3 py-1.5 hover:bg-muted transition-colors"
        >
          Hoy
        </button>
      </div>

      {(modo === 'turnos' ? loadingOfertas : loadingPeriodos) ? (
        <p className="text-muted-foreground text-sm py-8 text-center">Cargando...</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <MonthCalendar
              weeks={weeks}
              onDayClick={day => setDiaSeleccionado(day.date)}
              renderDay={(day: CalendarDay) => {
                if (modo === 'turnos') {
                  const delDia = ofertasPorDia.get(day.date) ?? [];
                  if (delDia.length === 0) return null;
                  return (
                    <div className="flex flex-wrap gap-0.5">
                      {delDia.slice(0, 6).map(o => (
                        <span key={o.id} className={`w-1.5 h-1.5 rounded-full ${ESTADO_OFERTA_DOT[o.estado]}`} />
                      ))}
                      {delDia.length > 6 && <span className="text-[10px] text-muted-foreground">+{delDia.length - 6}</span>}
                    </div>
                  );
                }
                const periodo = periodoDeDia(day.date);
                if (!periodo) return null;
                const esCierre = periodo.fecha_fin === day.date;
                return (
                  <div className={`flex-1 -m-1.5 mt-0 rounded-b-md px-1.5 py-1 ${ESTADO_PERIODO_BG[periodo.estado]}`}>
                    {esCierre && <span className="text-[9px] font-semibold text-foreground">Cierre</span>}
                  </div>
                );
              }}
            />
          </div>

          <div className="bg-card border border-border rounded-2xl p-4">
            {!diaSeleccionado ? (
              <p className="text-sm text-muted-foreground">Elegí un día para ver el detalle.</p>
            ) : (
              <div>
                <p className="text-sm font-semibold text-foreground mb-3">{fmtDate(diaSeleccionado)}</p>
                {modo === 'turnos' ? (
                  ofertasDelDiaSeleccionado.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Sin turnos este día.</p>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {ofertasDelDiaSeleccionado.map(o => (
                        <button
                          key={o.id}
                          onClick={() => navigate(`/turnos/${o.id}`)}
                          className="text-left border border-border rounded-xl px-3 py-2 hover:bg-muted transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${ESTADO_OFERTA_DOT[o.estado]}`} />
                            <p className="text-sm font-medium text-foreground truncate">{o.titulo}</p>
                          </div>
                          <p className="text-xs text-muted-foreground">{o.hora_inicio}{o.hora_fin_estimada ? ` – ${o.hora_fin_estimada}` : ''}</p>
                        </button>
                      ))}
                    </div>
                  )
                ) : !periodoDelDiaSeleccionado ? (
                  <p className="text-sm text-muted-foreground">Sin período que cubra este día.</p>
                ) : (
                  <button
                    onClick={() => navigate(`/nomina/${periodoDelDiaSeleccionado!.id}`)}
                    className="text-left border border-border rounded-xl px-3 py-2 hover:bg-muted transition-colors w-full"
                  >
                    <p className="text-sm font-medium text-foreground">
                      {fmtDate(periodoDelDiaSeleccionado.fecha_inicio)} — {fmtDate(periodoDelDiaSeleccionado.fecha_fin)}
                    </p>
                    <p className="text-xs text-muted-foreground capitalize">{periodoDelDiaSeleccionado.estado}</p>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
