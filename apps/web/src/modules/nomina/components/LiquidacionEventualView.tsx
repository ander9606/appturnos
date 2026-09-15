import { DollarSign, Calendar, Clock, Gift } from 'lucide-react';
import { useConfirm } from '@/shared/hooks/useConfirm';
import { ConfirmModal } from '@/shared/components/ConfirmModal';
import { ErrorState } from '@/shared/components/ErrorState';
import { StatCard } from '@/shared/components/StatCard';
import { fmtCOP, fmtHrs, fmtDate, bogotaToday } from '@/shared/lib/format';
import { usePeriodoActivoEventual, useLiquidacionEventual, useLiquidarEventual } from '../hooks/useNomina';
import type { PeriodoTurnoEventual, LineaLiquidacionEventual } from '@/modules/turnos/types';

/**
 * Turnos eventuales (extra) de trabajadores de nómina — segmento 'nomina' de
 * periodos_turno_eventual. Se paga como bono trimestral, no como contrato:
 * ver asignaciones.marcaje.service.js#marcarEgreso. Separado a propósito de
 * LiquidacionTurnosView (personal de turnos) — no se mezclan.
 */
export function LiquidacionEventualView() {
  const { confirmState, confirm, close } = useConfirm();
  const { data: periodoResp, isLoading: loadingPeriodo, isError, error, refetch } = usePeriodoActivoEventual();
  const periodo: PeriodoTurnoEventual | undefined = periodoResp?.data?.nomina;
  const { data: liqResp, isLoading: loadingLiq } = useLiquidacionEventual(periodo?.id ?? null);
  const lineas: LineaLiquidacionEventual[] = liqResp?.data?.lineas ?? [];
  const totalGeneral: number = liqResp?.data?.total_general ?? 0;
  const liquidar = useLiquidarEventual();

  const hoy = bogotaToday();
  const puedeLiquidar = periodo && periodo.estado === 'abierto' && periodo.fecha_fin < hoy;
  const isLoading = loadingPeriodo || loadingLiq;

  if (isLoading) return <p className="text-muted-foreground text-sm py-8 text-center">Cargando...</p>;
  if (isError) return <ErrorState error={error} onRetry={refetch} />;
  if (!periodo) return <p className="text-muted-foreground text-sm py-8 text-center">Sin período activo</p>;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Período trimestral</p>
          <p className="text-sm font-medium text-foreground">
            {fmtDate(periodo.fecha_inicio)} – {fmtDate(periodo.fecha_fin)}
            <span className={`ml-2 inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
              periodo.estado === 'abierto' ? 'bg-success-light text-success' : 'bg-muted text-muted-foreground'
            }`}>
              {periodo.estado === 'abierto' ? 'Abierto' : 'Liquidado'}
            </span>
          </p>
        </div>
        {puedeLiquidar && (
          <button
            onClick={() => confirm({
              title: 'Liquidar período',
              detail: `¿Confirmar el pago de ${fmtCOP(totalGeneral)} a ${lineas.length} trabajador${lineas.length !== 1 ? 'es' : ''}? Esta acción no se puede deshacer.`,
              confirmLabel: 'Liquidar',
              onConfirm: () => { liquidar.mutate(periodo.id); close(); },
            })}
            disabled={liquidar.isPending}
            className="text-xs border border-amber-300 text-warning hover:bg-warning-light px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
          >
            {liquidar.isPending ? 'Liquidando…' : 'Liquidar período'}
          </button>
        )}
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <StatCard label="Total a pagar" value={fmtCOP(totalGeneral)} icon={DollarSign} color="warning" />
        <StatCard label="Trabajadores" value={lineas.length} icon={Gift} />
        <StatCard label="Turnos" value={lineas.reduce((s, l) => s + l.turnos, 0)} icon={Calendar} />
      </div>

      {lineas.length === 0 ? (
        <p className="text-muted-foreground text-sm py-8 text-center">Sin turnos extra completados en este período</p>
      ) : (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted text-muted-foreground text-xs uppercase">
                <th className="text-left px-4 py-3 font-medium">Trabajador</th>
                <th className="text-right px-4 py-3 font-medium">Turnos</th>
                <th className="text-right px-4 py-3 font-medium">Horas</th>
                <th className="text-right px-4 py-3 font-medium">Bono</th>
              </tr>
            </thead>
            <tbody>
              {lineas.map(l => (
                <tr key={l.trabajador_id} className="border-t border-border/60">
                  <td className="px-4 py-3 font-medium text-foreground">{l.nombre_completo}</td>
                  <td className="px-4 py-3 text-right text-muted-foreground">{l.turnos}</td>
                  <td className="px-4 py-3 text-right text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Clock size={12} /> {fmtHrs(l.horas)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-foreground">{fmtCOP(l.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {confirmState && (
        <ConfirmModal
          title={confirmState.title}
          detail={confirmState.detail}
          confirmLabel={confirmState.confirmLabel ?? 'Confirmar'}
          pending={liquidar.isPending}
          onConfirm={confirmState.onConfirm}
          onCancel={close}
        />
      )}
    </div>
  );
}
