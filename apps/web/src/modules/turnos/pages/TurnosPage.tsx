import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Plus, ChevronRight, XCircle } from 'lucide-react';
import { useOfertas, useCrearOferta, useCancelarOferta } from '../hooks/useTurnos';
import type { EstadoOferta, Oferta } from '../types';

const ESTADO_BADGE: Record<EstadoOferta, string> = {
  borrador: 'bg-gray-100 text-gray-600',
  publicada: 'bg-blue-100 text-blue-700',
  en_progreso: 'bg-amber-100 text-amber-700',
  completada: 'bg-green-100 text-green-700',
  cancelada: 'bg-red-100 text-red-600',
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
        <h1 className="text-2xl font-bold text-gray-900">Turnos</h1>
        <button
          onClick={() => setShowCrear(true)}
          className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-3 py-2 rounded-lg transition-colors"
        >
          <Plus size={16} /> Nueva oferta
        </button>
      </div>

      <div className="flex gap-1 mb-4 border-b border-gray-200 overflow-x-auto">
        {ESTADOS_FILTER.map(e => (
          <button
            key={String(e)}
            onClick={() => setEstado(e)}
            className={`px-3 py-2 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
              estado === e
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {FILTER_LABELS[String(e)]}
          </button>
        ))}
      </div>

      {isLoading ? (
        <p className="text-gray-500 text-sm py-8 text-center">Cargando...</p>
      ) : ofertas.length === 0 ? (
        <p className="text-gray-500 text-sm py-8 text-center">No hay ofertas</p>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-xs uppercase">
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
                  <tr key={o.id} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{o.titulo}</td>
                    <td className="px-4 py-3 text-gray-600">{fmtDate(o.fecha)}</td>
                    <td className="px-4 py-3 text-gray-600">{o.hora_inicio}{o.hora_fin_estimada ? ` – ${o.hora_fin_estimada}` : ''}</td>
                    <td className="px-4 py-3 text-gray-600">{o.lugar ?? '—'}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{totalAsignados}/{totalPlazas}</td>
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
                            className="text-gray-400 hover:text-red-600 transition-colors"
                            title="Cancelar oferta"
                          >
                            <XCircle size={14} />
                          </button>
                        )}
                        <button
                          onClick={() => navigate(`/turnos/${o.id}`)}
                          className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium px-2 py-1 rounded-lg hover:bg-blue-50 transition-colors"
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
      <div className="bg-white rounded-2xl p-6 w-full max-w-lg">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Nueva oferta de turno</h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Título *</label>
            <input required type="text" {...field('titulo')} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fecha *</label>
              <input required type="date" {...field('fecha')} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Hora inicio *</label>
              <input required type="time" {...field('hora_inicio')} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Hora fin estimada</label>
              <input type="time" {...field('hora_fin_estimada')} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Lugar</label>
              <input type="text" {...field('lugar')} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
            <textarea rows={2} {...field('descripcion')} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
          </div>
          <p className="text-xs text-gray-500">Los puestos se agregan desde el detalle de la oferta.</p>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="flex-1 border border-gray-300 hover:bg-gray-50 text-sm font-medium py-2 rounded-lg transition-colors">Cancelar</button>
            <button type="submit" disabled={crear.isPending} className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium py-2 rounded-lg transition-colors">
              {crear.isPending ? 'Creando...' : 'Crear y configurar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
