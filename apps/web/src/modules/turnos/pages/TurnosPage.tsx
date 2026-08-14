import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Plus, ChevronRight, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useOfertas, useCrearOferta, useCancelarOferta, usePostulacionesPendientes } from '../hooks/useTurnos';
import type { EstadoOferta, Oferta, VisibilidadOferta } from '../types';
import { ErrorState } from '@/shared/components/ErrorState';
import { LugarInput } from '../components/LugarInput';
import { TrabajadorPickerModal, type DestinatarioSeleccionado } from '../components/TrabajadorPickerModal';
import { fmtDate, bogotaToday } from '@/shared/lib/format';

const ESTADO_BADGE: Record<EstadoOferta, string> = {
  borrador: 'bg-muted text-muted-foreground',
  abierta: 'bg-primary-100 text-primary-600',
  publicada: 'bg-primary-100 text-primary-600',
  en_proceso: 'bg-warning-light text-warning',
  cerrada: 'bg-muted text-muted-foreground',
  completada: 'bg-success-light text-success',
  cancelada: 'bg-danger-light text-danger',
};

const ESTADO_LABEL: Record<EstadoOferta, string> = {
  borrador: 'Borrador',
  abierta: 'Abierta',
  publicada: 'Publicada',
  en_proceso: 'En progreso',
  cerrada: 'Cerrada',
  completada: 'Completada',
  cancelada: 'Cancelada',
};

const ESTADOS_FILTER: (EstadoOferta | undefined)[] = [undefined, 'abierta', 'publicada', 'en_proceso', 'completada', 'borrador', 'cerrada', 'cancelada'];
const FILTER_LABELS: Record<string, string> = {
  undefined: 'Todas', abierta: 'Abiertas', publicada: 'Publicadas', en_proceso: 'En progreso',
  completada: 'Completadas', borrador: 'Borrador', cerrada: 'Cerradas', cancelada: 'Canceladas',
};

export function TurnosPage() {
  const navigate = useNavigate();
  const [estado, setEstado] = useState<EstadoOferta | undefined>(undefined);
  const [showCrear, setShowCrear] = useState(false);

  const { data, isLoading, isError, error, refetch } = useOfertas({ estado, limit: 100 });
  const ofertas: Oferta[] = data?.data?.data ?? [];
  const cancelar = useCancelarOferta();
  const today = bogotaToday();

  const { data: pendientesData } = usePostulacionesPendientes();
  const pendientesPorOferta = new Map<number, number>();
  for (const a of pendientesData?.data?.data ?? []) {
    pendientesPorOferta.set(a.oferta_id, (pendientesPorOferta.get(a.oferta_id) ?? 0) + 1);
  }
  const totalPendientes = pendientesData?.data?.pagination?.total ?? 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-foreground">Turnos</h1>
          {totalPendientes > 0 && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-warning-light text-warning">
              {totalPendientes} postulante{totalPendientes !== 1 ? 's' : ''} esperando revisión
            </span>
          )}
        </div>
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
      ) : isError ? (
        <ErrorState error={error} onRetry={refetch} />
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
                const totalAsignados = o.puestos?.reduce((s, p) => s + p.plazas_cubiertas, 0) ?? 0;
                const pendientes = pendientesPorOferta.get(o.id) ?? 0;
                const esPasado = o.fecha < today;
                return (
                  <tr key={o.id} className={`border-t border-border/60 hover:bg-muted transition-opacity ${esPasado ? 'opacity-50' : ''}`}>
                    <td className={`px-4 py-3 font-medium ${esPasado ? 'text-muted-foreground' : 'text-foreground'}`}>{o.titulo}</td>
                    <td className="px-4 py-3 text-muted-foreground">{fmtDate(o.fecha)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{o.hora_inicio}{o.hora_fin_estimada ? ` – ${o.hora_fin_estimada}` : ''}</td>
                    <td className="px-4 py-3 text-muted-foreground">{o.lugar ?? '—'}</td>
                    <td className="px-4 py-3 text-right text-muted-foreground">{totalAsignados}/{totalPlazas}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${ESTADO_BADGE[o.estado]}`}>
                          {ESTADO_LABEL[o.estado]}
                        </span>
                        {pendientes > 0 && (
                          <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-warning-light text-warning">
                            {pendientes} pendiente{pendientes !== 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 justify-end">
                        {(o.estado !== 'completada' && o.estado !== 'cancelada') && (
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
  const [latitud, setLatitud] = useState<number | null>(null);
  const [longitud, setLongitud] = useState<number | null>(null);
  const [visibilidad, setVisibilidad] = useState<VisibilidadOferta>('abierta');
  const [destinatarios, setDestinatarios] = useState<DestinatarioSeleccionado[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);

  const dirigidaSinPersonas = visibilidad === 'dirigida' && destinatarios.length === 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (dirigidaSinPersonas) return;
    if (form.fecha < bogotaToday()) {
      toast.error('La fecha del turno no puede ser en el pasado');
      return;
    }
    if (form.hora_fin_estimada && form.hora_fin_estimada <= form.hora_inicio) {
      toast.error('La hora de fin debe ser posterior a la hora de inicio');
      return;
    }
    const res = await crear.mutateAsync({
      titulo: form.titulo,
      fecha: form.fecha,
      hora_inicio: form.hora_inicio,
      hora_fin_estimada: form.hora_fin_estimada || undefined,
      descripcion: form.descripcion || undefined,
      lugar: form.lugar || undefined,
      latitud: latitud ?? undefined,
      longitud: longitud ?? undefined,
      visibilidad,
      trabajador_ids: visibilidad === 'dirigida' ? destinatarios.map(d => d.id) : undefined,
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
              <input required type="date" min={bogotaToday()} {...field('fecha')} className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Hora inicio *</label>
              <input required type="time" {...field('hora_inicio')} className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Hora fin estimada</label>
            <input type="time" {...field('hora_fin_estimada')} className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Lugar</label>
            <LugarInput
              value={form.lugar}
              latitud={latitud}
              longitud={longitud}
              onChange={(lugar, lat, lng) => {
                setForm(f => ({ ...f, lugar }));
                setLatitud(lat);
                setLongitud(lng);
              }}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Descripción</label>
            <textarea rows={2} {...field('descripcion')} className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">¿Quién puede ver esta oferta?</label>
            <div className="grid grid-cols-2 gap-2">
              {([
                { value: 'abierta' as const, label: 'Todos los que califican' },
                { value: 'dirigida' as const, label: 'Personas específicas' },
              ]).map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setVisibilidad(opt.value)}
                  className={`text-xs font-medium py-2 rounded-lg border transition-colors ${
                    visibilidad === opt.value
                      ? 'border-primary bg-primary-50 text-primary-600'
                      : 'border-border text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {visibilidad === 'dirigida' && (
              <button
                type="button"
                onClick={() => setPickerOpen(true)}
                className="mt-2 w-full flex items-center justify-between border border-border rounded-lg px-3 py-2 text-sm hover:bg-muted transition-colors"
              >
                <span className={dirigidaSinPersonas ? 'text-danger' : 'text-foreground'}>
                  {destinatarios.length === 0
                    ? 'Elegir personas'
                    : `${destinatarios.length} persona${destinatarios.length !== 1 ? 's' : ''} elegida${destinatarios.length !== 1 ? 's' : ''}`}
                </span>
                <span className="text-muted-foreground text-xs">Cambiar</span>
              </button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">Los puestos se agregan desde el detalle de la oferta.</p>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="flex-1 border border-border hover:bg-muted text-sm font-medium py-2 rounded-lg transition-colors">Cancelar</button>
            <button type="submit" disabled={crear.isPending || dirigidaSinPersonas} className="flex-1 bg-primary hover:bg-primary-600 disabled:opacity-50 text-white text-sm font-medium py-2 rounded-lg transition-colors">
              {crear.isPending ? 'Creando...' : 'Crear y configurar'}
            </button>
          </div>
        </form>
      </div>

      {pickerOpen && (
        <TrabajadorPickerModal
          seleccionados={destinatarios}
          onConfirm={setDestinatarios}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </div>
  );
}
