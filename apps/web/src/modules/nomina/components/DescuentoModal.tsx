import { useState } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import { useCrearDescuento, useEliminarDescuento } from '../hooks/useNomina';
import type { TipoDescuento, DescuentoNomina } from '../types';
import { Modal } from '@/shared/components/Modal';
import { ConfirmModal } from '@/shared/components/ConfirmModal';
import { useConfirm } from '@/shared/hooks/useConfirm';
import { fmtCOP } from '@/shared/lib/format';
import { TIPO_DESCUENTO_LABELS, ESTADO_DESCUENTO_BADGE } from '../constants';

export function DescuentoModal({
  periodoId, trabajadorId, trabajadorNombre, descuentos, onClose,
}: {
  periodoId: number;
  trabajadorId: number;
  trabajadorNombre: string;
  descuentos: DescuentoNomina[];
  onClose: () => void;
}) {
  const crear = useCrearDescuento();
  const eliminar = useEliminarDescuento();
  const { confirmState, confirm, close: closeConfirm } = useConfirm();
  const [showForm, setShowForm] = useState(descuentos.length === 0);
  const [form, setForm] = useState({ tipo: 'prestamo' as TipoDescuento, motivo: '', monto: '' });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await crear.mutateAsync({
      trabajador_id: trabajadorId,
      periodo_id: periodoId,
      tipo: form.tipo,
      motivo: form.motivo,
      monto: Number(form.monto),
    });
    setForm({ tipo: 'prestamo', motivo: '', monto: '' });
    setShowForm(false);
  };

  return (
    <Modal onClose={onClose} scrollable>
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-lg font-semibold text-foreground">Descuentos</h2>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
      </div>
      <p className="text-sm text-muted-foreground mb-4">{trabajadorNombre}</p>

      {descuentos.length > 0 && (
        <div className="flex flex-col gap-2 mb-4">
          {descuentos.map(d => (
            <div key={d.id} className="border border-border rounded-xl p-3 flex items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${ESTADO_DESCUENTO_BADGE[d.estado]}`}>
                    {d.estado === 'pendiente' ? 'Por aceptar' : d.estado === 'aceptado' ? 'Aceptado' : 'Rechazado'}
                  </span>
                  <span className="text-xs font-medium text-foreground">{TIPO_DESCUENTO_LABELS[d.tipo]}</span>
                </div>
                <p className="text-xs text-muted-foreground">{d.motivo}</p>
                <p className="text-sm font-semibold text-danger mt-1">-{fmtCOP(d.monto)}</p>
              </div>
              <button
                onClick={() => confirm({
                  title: 'Eliminar descuento',
                  detail: `¿Eliminar el descuento de "${d.motivo}" por ${fmtCOP(d.monto)}? Esta acción no se puede deshacer.`,
                  confirmLabel: 'Eliminar',
                  onConfirm: () => { eliminar.mutate(d.id); closeConfirm(); },
                })}
                className="text-muted-foreground/60 hover:text-danger transition-colors flex-shrink-0"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {showForm ? (
        <form onSubmit={handleSubmit} className="flex flex-col gap-3 border-t border-border pt-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Tipo</label>
            <select
              value={form.tipo}
              onChange={e => setForm(f => ({ ...f, tipo: e.target.value as TipoDescuento }))}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-success/40"
            >
              {Object.entries(TIPO_DESCUENTO_LABELS).map(([v, label]) => <option key={v} value={v}>{label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Motivo *</label>
            <input
              required
              type="text"
              placeholder="Ej. Préstamo del 12 de marzo"
              value={form.motivo}
              onChange={e => setForm(f => ({ ...f, motivo: e.target.value }))}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-success/40"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Monto (COP) *</label>
            <input
              required
              type="number"
              min="1"
              step="any"
              value={form.monto}
              onChange={e => setForm(f => ({ ...f, monto: e.target.value }))}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-success/40"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Queda pendiente hasta que el trabajador lo acepte desde su app — no se descuenta de su neto todavía.
          </p>
          <div className="flex gap-2 pt-1">
            {descuentos.length > 0 && (
              <button type="button" onClick={() => setShowForm(false)} className="flex-1 border border-border hover:bg-muted text-sm font-medium py-2 rounded-lg transition-colors">
                Cancelar
              </button>
            )}
            <button type="submit" disabled={crear.isPending} className="flex-1 bg-success hover:bg-success-600 disabled:opacity-50 text-white text-sm font-medium py-2 rounded-lg transition-colors">
              {crear.isPending ? 'Guardando...' : 'Registrar descuento'}
            </button>
          </div>
        </form>
      ) : (
        <button
          onClick={() => setShowForm(true)}
          className="w-full flex items-center justify-center gap-1.5 border border-dashed border-border hover:bg-muted text-sm font-medium text-muted-foreground py-2.5 rounded-lg transition-colors"
        >
          <Plus size={14} /> Agregar otro descuento
        </button>
      )}

      {confirmState && (
        <ConfirmModal
          title={confirmState.title}
          detail={confirmState.detail}
          confirmLabel={confirmState.confirmLabel ?? 'Confirmar'}
          onConfirm={confirmState.onConfirm}
          onCancel={closeConfirm}
        />
      )}
    </Modal>
  );
}
