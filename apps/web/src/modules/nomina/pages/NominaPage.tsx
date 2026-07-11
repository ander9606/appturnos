import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Plus, ChevronRight } from 'lucide-react';
import { usePeriodos, useCrearPeriodo, useCerrarPeriodo, useLiquidarPeriodo } from '../hooks/useNomina';
import type { EstadoPeriodo, TipoPeriodo, Periodo } from '../types';
import { ErrorState } from '@/shared/components/ErrorState';
import { ConfirmModal } from '@/shared/components/ConfirmModal';

const ESTADO_BADGE: Record<EstadoPeriodo, string> = {
  abierto: 'bg-success-light text-success',
  cerrado: 'bg-warning-light text-warning',
  liquidado: 'bg-primary-100 text-primary-600',
};

const TIPO_LABEL: Record<TipoPeriodo, string> = {
  semanal: 'Semanal',
  quincenal: 'Quincenal',
  mensual: 'Mensual',
};

function fmtDate(s: string) {
  return new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium' }).format(new Date(s + 'T00:00:00'));
}

export function NominaPage() {
  const navigate = useNavigate();
  const [filtroEstado, setFiltroEstado] = useState<EstadoPeriodo | undefined>(undefined);
  const [showModal, setShowModal] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{ type: 'cerrar' | 'liquidar'; periodo: Periodo } | null>(null);

  const { data, isLoading, isError, error, refetch } = usePeriodos(filtroEstado);
  const periodos: Periodo[] = data?.data ?? [];

  const cerrar = useCerrarPeriodo();
  const liquidar = useLiquidarPeriodo();

  const tabs: { label: string; value: EstadoPeriodo | undefined }[] = [
    { label: 'Todos', value: undefined },
    { label: 'Abiertos', value: 'abierto' },
    { label: 'Cerrados', value: 'cerrado' },
    { label: 'Liquidados', value: 'liquidado' },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-foreground">Nómina</h1>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-1.5 bg-primary hover:bg-primary-600 text-white text-sm font-medium px-3 py-2 rounded-lg transition-colors"
        >
          <Plus size={16} /> Nuevo período
        </button>
      </div>

      <div className="flex gap-1 mb-4 border-b border-border">
        {tabs.map(t => (
          <button
            key={String(t.value)}
            onClick={() => setFiltroEstado(t.value)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              filtroEstado === t.value
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <p className="text-muted-foreground text-sm py-8 text-center">Cargando...</p>
      ) : isError ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : periodos.length === 0 ? (
        <p className="text-muted-foreground text-sm py-8 text-center">No hay períodos</p>
      ) : (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted text-muted-foreground text-xs uppercase">
                <th className="text-left px-4 py-3 font-medium">Período</th>
                <th className="text-left px-4 py-3 font-medium">Tipo</th>
                <th className="text-left px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {periodos.map(p => (
                <tr key={p.id} className="border-t border-border/60 hover:bg-muted">
                  <td className="px-4 py-3 text-foreground">
                    {fmtDate(p.fecha_inicio)} — {fmtDate(p.fecha_fin)}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{TIPO_LABEL[p.tipo]}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${ESTADO_BADGE[p.estado]}`}>
                      {p.estado.charAt(0).toUpperCase() + p.estado.slice(1)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 justify-end">
                      {p.estado === 'abierto' && (
                        <button
                          onClick={() => setConfirmAction({ type: 'cerrar', periodo: p })}
                          disabled={cerrar.isPending}
                          className="text-xs border border-border hover:bg-muted px-2 py-1 rounded-lg transition-colors"
                        >
                          Cerrar
                        </button>
                      )}
                      {p.estado === 'cerrado' && (
                        <button
                          onClick={() => setConfirmAction({ type: 'liquidar', periodo: p })}
                          disabled={liquidar.isPending}
                          className="text-xs border border-amber-300 text-warning hover:bg-warning-light px-2 py-1 rounded-lg transition-colors"
                        >
                          Liquidar
                        </button>
                      )}
                      <button
                        onClick={() => navigate(`/nomina/${p.id}`)}
                        className="flex items-center gap-1 text-xs text-primary hover:text-primary-600 font-medium px-2 py-1 rounded-lg hover:bg-primary-50 transition-colors"
                      >
                        Ver <ChevronRight size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && <NuevoPeriodoModal onClose={() => setShowModal(false)} />}

      {confirmAction && (
        <ConfirmModal
          title={confirmAction.type === 'cerrar' ? 'Cerrar período' : 'Liquidar período'}
          detail={
            confirmAction.type === 'cerrar'
              ? `Se congelará el valor hora de todos los registros de ${fmtDate(confirmAction.periodo.fecha_inicio)} — ${fmtDate(confirmAction.periodo.fecha_fin)}. Ya no se podrán editar registros de este período.`
              : `Se marcará como pagado el período ${fmtDate(confirmAction.periodo.fecha_inicio)} — ${fmtDate(confirmAction.periodo.fecha_fin)}. Esta acción no se puede deshacer.`
          }
          confirmLabel={confirmAction.type === 'cerrar' ? 'Cerrar período' : 'Marcar liquidado'}
          pending={confirmAction.type === 'cerrar' ? cerrar.isPending : liquidar.isPending}
          onCancel={() => setConfirmAction(null)}
          onConfirm={() => {
            const { type, periodo } = confirmAction;
            const mutation = type === 'cerrar' ? cerrar : liquidar;
            mutation.mutate(periodo.id, { onSuccess: () => setConfirmAction(null) });
          }}
        />
      )}
    </div>
  );
}

function NuevoPeriodoModal({ onClose }: { onClose: () => void }) {
  const crear = useCrearPeriodo();
  const [form, setForm] = useState({ fecha_inicio: '', fecha_fin: '', tipo: 'mensual' as TipoPeriodo });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await crear.mutateAsync(form);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-2xl p-6 w-full max-w-md">
        <h2 className="text-lg font-semibold text-foreground mb-4">Nuevo período</h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Fecha inicio</label>
            <input
              type="date"
              required
              value={form.fecha_inicio}
              onChange={e => setForm(f => ({ ...f, fecha_inicio: e.target.value }))}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Fecha fin</label>
            <input
              type="date"
              required
              value={form.fecha_fin}
              onChange={e => setForm(f => ({ ...f, fecha_fin: e.target.value }))}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Tipo</label>
            <select
              value={form.tipo}
              onChange={e => setForm(f => ({ ...f, tipo: e.target.value as TipoPeriodo }))}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              <option value="semanal">Semanal</option>
              <option value="quincenal">Quincenal</option>
              <option value="mensual">Mensual</option>
            </select>
          </div>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="flex-1 border border-border hover:bg-muted text-sm font-medium py-2 rounded-lg transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={crear.isPending} className="flex-1 bg-primary hover:bg-primary-600 disabled:opacity-50 text-white text-sm font-medium py-2 rounded-lg transition-colors">
              {crear.isPending ? 'Creando...' : 'Crear'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
