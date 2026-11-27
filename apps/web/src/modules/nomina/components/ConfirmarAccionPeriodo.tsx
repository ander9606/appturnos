import type { Periodo } from '../types';
import { useCerrarPeriodo, useLiquidarPeriodo } from '../hooks/useNomina';
import { ConfirmModal } from '@/shared/components/ConfirmModal';
import { fmtDate } from '@/shared/lib/format';

export type AccionPeriodo = { type: 'cerrar' | 'liquidar'; periodo: Pick<Periodo, 'id' | 'fecha_inicio' | 'fecha_fin'> };

/** Confirmación de Cerrar / Liquidar — la misma en la lista de períodos y en el detalle. */
export function ConfirmarAccionPeriodo({ accion, onDone }: { accion: AccionPeriodo; onDone: () => void }) {
  const cerrar = useCerrarPeriodo();
  const liquidar = useLiquidarPeriodo();
  const { type, periodo } = accion;
  const rango = `${fmtDate(periodo.fecha_inicio)} — ${fmtDate(periodo.fecha_fin)}`;
  const mutation = type === 'cerrar' ? cerrar : liquidar;
  return (
    <ConfirmModal
      title={type === 'cerrar' ? 'Cerrar período' : 'Liquidar período'}
      detail={
        type === 'cerrar'
          ? `Se congelará el valor hora de todos los registros de ${rango}. Ya no se podrán editar registros de este período.`
          : `Se marcará como pagado el período ${rango}. Esta acción no se puede deshacer.`
      }
      confirmLabel={type === 'cerrar' ? 'Cerrar período' : 'Marcar liquidado'}
      pending={mutation.isPending}
      onCancel={onDone}
      onConfirm={() => mutation.mutate(periodo.id, { onSuccess: onDone })}
    />
  );
}
