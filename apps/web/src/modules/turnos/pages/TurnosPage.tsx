import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Plus, ChevronRight, XCircle } from 'lucide-react';
import { useOfertas, useCrearOferta, useCancelarOferta } from '../hooks/useTurnos';
import type { EstadoOferta, Oferta } from '../types';

const ESTADO_BADGE: Record<EstadoOferta, string> = {
  borrador: 'bg-muted text-muted-foreground',
  publicada: 'bg-primary-100 text-primary-600',
  en_progreso: 'bg-warning-light text-warning',
  completada: 'bg-success-light text-success',
  cancelada: 'bg-danger-light text-danger',
};

const ESTADO_LABEL: Record<EstadoOferta, string> = {
  borrador: 'Borrador',
  publicada: 'Publicada',
  en_progreso: 'En progreso',
  completada: 'Completada',
  cancelada: 'Cancelada',
};

function fmtDate(s: string) {
  return new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium' }).format(new Date(s + 'T00:00:00'));
}

const ESTADOS_FILTER: (EstadoOferta | undefined)[] = [undefined, 'publicada', 'en_progreso', 'completada', 'borrador', 'cancelada'];
const FILTER_LABELS: Record<string, string> = {
  undefined: 'Todas', publicada: 'Publicadas', en_progreso: 'En progreso',
  completada: 'Completadas', borrador: 'Borrador', cancelada: 'Canceladas',
};

export function TurnosPage() {
  const navigate = useNavigate();
  const [estado, setEstado] = useState<EstadoOferta | undefined>(undefined);
  const [showCrear, setShowCrear] = useState(false);

  const { data, isLoading } = useOfertas({ estado, limit: 100 });
  const ofertas: Oferta[] = data?.data ?? [];
  const cancelar = useCancelarOferta();

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-foreground">Turnos</h1>
        <button
          onClick={() => setShowCrear(true)}
          className="flex items-center gap-1.5 bg-primary hover:bg-primary-600 text-white text-sm font-medium px-3 py-2 rounded-lg transition-colors"
        >
          <Plus size={16} /> Nueva oferta
        </button>
      </div>

      <div className="flex gap-1 mb-4 border-b border-border overflow-x-auto">
        {ESTADOS_FILTER.map(e => (
          <button
            key={String(e)}
            onClick={() => setEstado(e)}
            className={`px-3 py-2 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
              estado === e
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {FILTER_LABELS[String(e)]}
          </button>
        ))}
      </div>

      {isLoading ? (
        <p className="text-muted-foreground text-sm py-8 text-center">Cargando...</p>
      ) : ofertas.length === 0 ? (
        <p className="text-muted-foreground text-sm py-8 text-center">No hay ofertas</p>
      ) : (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted text-muted-foreground text-xs uppercase">
                <th className="text-left px-4 py-3 font-medium">Título</th>
                <th className="text-left px-4 py-3 font-medium">Fecha</th>
                <th className="text-left px-4 py-3 font-medium">Hora</th>
                <th className="text-left px-4 py-3 font-medium">Lugar</th>
                <th className="text-right px-4 py-3 font-medium">Puestos</th>
                <th className="text-left px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {ofertas.map(o => {
                const totalPlazas = o.puestos?.reduce((s, p) => s + p.plazas, 0) ?? 0;
                const totalAsignados = o.puestos?.reduce((s, p) => s + p.asignados, 0) ?? 0;
                return (
                  <tr key={o.id} className="border-t border-border/60 hover:bg-muted">
                    <td className="px-4 py-3 font-medium text-foreground">{o.titulo}</td>
                    <td className="px-4 py-3 text-muted-foreground">{fmtDate(o.fecha)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{o.hora_inicio}{o.hora_fin_estimada ? ` – ${o.hora_fin_estimada}` : ''}</td>
                    <td className="px-4 py-3 text-muted-foreground">{o.lugar ?? '—'}</td>
                    <td className="px-4 py-3 text-right text-muted-foreground">{totalAsignados}/{totalPlazas}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${ESTADO_BADGE[o.estado]}`}>
                        {ESTADO_LABEL[o.estado]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 justify-end">
                        {(o.estado === 'publicada' || o.estado === 'borrador') && (
                          <button
                            onClick={() => {
                              if (window.confirm(`¿Cancelar la oferta "${o.titulo}"?`)) {
                                cancelar.mutate(o.id);
                              }
                            }}
                            className="text-muted-foreground/60 hover:text-danger transition-colors"
                            title="Cancelar oferta"
                          >
                            <XCircle size={14} />
                          </button>
                        )}
                        <button
                          onClick={() => navigate(`/turnos/${o.id}`)}
                          className="flex items-center gap-1 text-xs text-primary hover:text-primary-600 font-medium px-2 py-1 rounded-lg hover:bg-primary-50 transition-colors"
                        >
                          Ver <ChevronRight size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showCrear && <NuevaOfertaModal onClose={() => setShowCrear(false)} />}
    </div>
  );
}

function NuevaOfertaModal({ onClose }: { onClose: () => void }) {
  const crear = useCrearOferta();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    titulo: '', fecha: '', hora_inicio: '', hora_fin_estimada: '',
    descripcion: '', lugar: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await crear.mutateAsync({
      titulo: form.titulo,
      fecha: form.fecha,
      hora_inicio: form.hora_inicio,
      hora_fin_estimada: form.hora_fin_estimada || undefined,
      descripcion: form.descripcion || undefined,
      lugar: form.lugar || undefined,
      puestos: [],
    });
    onClose();
    if (res?.data?.id) navigate(`/turnos/${res.data.id as number}`);
  };

  const field = (key: keyof typeof form) => ({
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm(f => ({ ...f, [key]: e.target.value })),
  });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-2xl p-6 w-full max-w-lg">
        <h2 className="text-lg font-semibold text-foreground mb-4">Nueva oferta de turno</h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Título *</label>
            <input required type="text" {...field('titulo')} className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Fecha *</label>
              <input required type="date" {...field('fecha')} className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Hora inicio *</label>
              <input required type="time" {...field('hora_inicio')} className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Hora fin estimada</label>
              <input type="time" {...field('hora_fin_estimada')} className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Lugar</label>
              <input type="text" {...field('lugar')} className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Descripción</label>
            <textarea rows={2} {...field('descripcion')} className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none" />
          </div>
          <p className="text-xs text-muted-foreground">Los puestos se agregan desde el detalle de la oferta.</p>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="flex-1 border border-border hover:bg-muted text-sm font-medium py-2 rounded-lg transition-colors">Cancelar</button>
            <button type="submit" disabled={crear.isPending} className="flex-1 bg-primary hover:bg-primary-600 disabled:opacity-50 text-white text-sm font-medium py-2 rounded-lg transition-colors">
              {crear.isPending ? 'Creando...' : 'Crear y configurar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
