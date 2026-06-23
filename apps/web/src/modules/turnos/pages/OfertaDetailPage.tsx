import { useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { ArrowLeft, Star } from 'lucide-react';
import {
  useOferta, useAsignaciones,
  useConfirmarAsignacion, useRechazarAsignacion, useCancelarAsignacion,
  useNoPresentado, useCalificar,
} from '../hooks/useTurnos';
import type { EstadoAsignacion, EstadoOferta, Asignacion } from '../types';

const ESTADO_OFERTA_BADGE: Record<EstadoOferta, string> = {
  borrador: 'bg-muted text-muted-foreground',
  publicada: 'bg-primary-100 text-primary-600',
  en_progreso: 'bg-warning-light text-warning',
  completada: 'bg-success-light text-success',
  cancelada: 'bg-danger-light text-danger',
};

const ESTADO_ASIG_BADGE: Record<EstadoAsignacion, string> = {
  pendiente: 'bg-muted text-muted-foreground',
  confirmado: 'bg-primary-100 text-primary-600',
  en_progreso: 'bg-warning-light text-warning',
  completado: 'bg-success-light text-success',
  no_presentado: 'bg-danger-light text-danger',
  cancelado: 'bg-muted text-muted-foreground/60',
};

const ESTADO_ASIG_LABEL: Record<EstadoAsignacion, string> = {
  pendiente: 'Pendiente', confirmado: 'Confirmado', en_progreso: 'En progreso',
  completado: 'Completado', no_presentado: 'No presentado', cancelado: 'Cancelado',
};

function fmtDate(s: string) {
  return new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium' }).format(new Date(s + 'T00:00:00'));
}

function fmtCOP(n: number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);
}

export function OfertaDetailPage() {
  const { id } = useParams<{ id: string }>();
  const ofertaId = Number(id);
  const navigate = useNavigate();
  const [tab, setTab] = useState<'asignaciones' | 'puestos'>('asignaciones');
  const [filtroEstado, setFiltroEstado] = useState<EstadoAsignacion | undefined>(undefined);
  const [calificandoId, setCalificandoId] = useState<number | null>(null);

  const { data: ofertaData, isLoading: loadingOferta } = useOferta(ofertaId);
  const oferta = ofertaData?.data;

  const { data: asigData, isLoading: loadingAsig } = useAsignaciones({
    oferta_id: ofertaId,
    estado: filtroEstado,
  });
  const asignaciones: Asignacion[] = asigData?.data ?? [];

  const confirmar = useConfirmarAsignacion();
  const rechazar = useRechazarAsignacion();
  const cancelarAsig = useCancelarAsignacion();
  const noPresentado = useNoPresentado();

  const calificandoAsig = calificandoId !== null
    ? asignaciones.find(a => a.id === calificandoId)
    : null;

  const estadoTabs: { label: string; value: EstadoAsignacion | undefined }[] = [
    { label: 'Todas', value: undefined },
    { label: 'Pendientes', value: 'pendiente' },
    { label: 'Confirmadas', value: 'confirmado' },
    { label: 'Completadas', value: 'completado' },
    { label: 'No presentados', value: 'no_presentado' },
  ];

  if (loadingOferta) return <p className="text-muted-foreground text-sm py-8 text-center">Cargando...</p>;
  if (!oferta) return <p className="text-muted-foreground text-sm py-8 text-center">Oferta no encontrada</p>;

  return (
    <div>
      <button
        onClick={() => navigate('/turnos')}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors"
      >
        <ArrowLeft size={16} /> Volver a Turnos
      </button>

      {/* Header card */}
      <div className="bg-card border border-border rounded-2xl p-5 mb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-foreground mb-1">{oferta.titulo}</h2>
            <p className="text-sm text-muted-foreground">
              {fmtDate(oferta.fecha)} · {oferta.hora_inicio}
              {oferta.hora_fin_estimada ? ` – ${oferta.hora_fin_estimada as string}` : ''}
              {oferta.lugar ? ` · ${oferta.lugar as string}` : ''}
            </p>
            {oferta.descripcion && <p className="text-sm text-muted-foreground mt-2">{oferta.descripcion as string}</p>}
          </div>
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${ESTADO_OFERTA_BADGE[oferta.estado as EstadoOferta]}`}>
            {(oferta.estado as string).charAt(0).toUpperCase() + (oferta.estado as string).slice(1).replace('_', ' ')}
          </span>
        </div>
        {Array.isArray(oferta.puestos) && oferta.puestos.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {(oferta.puestos as Array<{ id: number; cargo_nombre: string; asignados: number; plazas: number; tarifa_dia: number }>).map(p => (
              <span key={p.id} className="text-xs bg-muted text-muted-foreground px-2 py-1 rounded-lg">
                {p.cargo_nombre} · {p.asignados}/{p.plazas} · {fmtCOP(p.tarifa_dia)}/día
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-border">
        {(['asignaciones', 'puestos'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors capitalize ${
              tab === t ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {t === 'asignaciones' ? 'Asignaciones' : 'Puestos'}
          </button>
        ))}
      </div>

      {tab === 'puestos' && (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted text-muted-foreground text-xs uppercase">
                <th className="text-left px-4 py-3 font-medium">Cargo</th>
                <th className="text-right px-4 py-3 font-medium">Plazas</th>
                <th className="text-right px-4 py-3 font-medium">Asignados</th>
                <th className="text-right px-4 py-3 font-medium">Tarifa/día</th>
                <th className="text-left px-4 py-3 font-medium">Notas</th>
              </tr>
            </thead>
            <tbody>
              {((oferta.puestos ?? []) as Array<{ id: number; cargo_nombre: string; plazas: number; asignados: number; tarifa_dia: number; notas: string | null }>).map(p => (
                <tr key={p.id} className="border-t border-border/60">
                  <td className="px-4 py-3 text-foreground">{p.cargo_nombre}</td>
                  <td className="px-4 py-3 text-right text-muted-foreground">{p.plazas}</td>
                  <td className="px-4 py-3 text-right text-muted-foreground">{p.asignados}</td>
                  <td className="px-4 py-3 text-right text-muted-foreground">{fmtCOP(p.tarifa_dia)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{p.notas ?? '—'}</td>
                </tr>
              ))}
              {(!oferta.puestos || (oferta.puestos as unknown[]).length === 0) && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground/60 text-sm">Sin puestos</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'asignaciones' && (
        <div>
          <div className="flex gap-1 mb-4 border-b border-border overflow-x-auto">
            {estadoTabs.map(t => (
              <button
                key={String(t.value)}
                onClick={() => setFiltroEstado(t.value)}
                className={`px-3 py-2 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                  filtroEstado === t.value
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {loadingAsig ? (
            <p className="text-muted-foreground text-sm py-8 text-center">Cargando...</p>
          ) : asignaciones.length === 0 ? (
            <p className="text-muted-foreground text-sm py-8 text-center">Sin asignaciones</p>
          ) : (
            <div className="bg-card border border-border rounded-xl overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted text-muted-foreground text-xs uppercase">
                    <th className="text-left px-4 py-3 font-medium">Trabajador</th>
                    <th className="text-left px-4 py-3 font-medium">Puesto</th>
                    <th className="text-left px-4 py-3 font-medium">Estado</th>
                    <th className="text-left px-4 py-3 font-medium">Ingreso</th>
                    <th className="text-left px-4 py-3 font-medium">Egreso</th>
                    <th className="text-right px-4 py-3 font-medium">Cal.</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {asignaciones.map(a => (
                    <tr key={a.id} className="border-t border-border/60 hover:bg-muted">
                      <td className="px-4 py-3 text-foreground">
                        {a.trabajador ? `${a.trabajador.nombre} ${a.trabajador.apellido}` : String(a.trabajador_id)}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{a.puesto?.cargo_nombre ?? '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${ESTADO_ASIG_BADGE[a.estado]}`}>
                          {ESTADO_ASIG_LABEL[a.estado]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{a.hora_ingreso ?? '—'}</td>
                      <td className="px-4 py-3 text-muted-foreground">{a.hora_egreso ?? '—'}</td>
                      <td className="px-4 py-3 text-right text-muted-foreground">
                        {a.calificacion !== null ? `${a.calificacion}★` : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 justify-end">
                          {a.estado === 'pendiente' && (
                            <>
                              <button onClick={() => confirmar.mutate(a.id)} className="text-xs text-success hover:bg-success-light px-2 py-1 rounded transition-colors">✓</button>
                              <button onClick={() => rechazar.mutate(a.id)} className="text-xs text-danger hover:bg-danger-light px-2 py-1 rounded transition-colors">✗</button>
                            </>
                          )}
                          {a.estado === 'confirmado' && (
                            <button onClick={() => cancelarAsig.mutate(a.id)} className="text-xs text-muted-foreground hover:bg-muted px-2 py-1 rounded transition-colors">Cancelar</button>
                          )}
                          {a.estado === 'completado' && (
                            <>
                              {a.calificacion === null && (
                                <button
                                  onClick={() => setCalificandoId(a.id)}
                                  className="flex items-center gap-1 text-xs text-warning hover:bg-warning-light px-2 py-1 rounded transition-colors"
                                >
                                  <Star size={12} /> Calificar
                                </button>
                              )}
                            </>
                          )}
                          {(a.estado === 'confirmado' || a.estado === 'en_progreso') && (
                            <button
                              onClick={() => {
                                if (window.confirm('¿Marcar como no presentado?')) noPresentado.mutate(a.id);
                              }}
                              className="text-xs text-danger hover:bg-danger-light px-2 py-1 rounded transition-colors"
                            >
                              NP
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {calificandoAsig && (
        <CalificarModal
          asignacion={calificandoAsig}
          onClose={() => setCalificandoId(null)}
        />
      )}
    </div>
  );
}

function CalificarModal({ asignacion, onClose }: { asignacion: Asignacion; onClose: () => void }) {
  const calificar = useCalificar();
  const [calificacion, setCalificacion] = useState(5);
  const [comentario, setComentario] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await calificar.mutateAsync({ id: asignacion.id, calificacion, comentario: comentario || undefined });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-2xl p-6 w-full max-w-sm">
        <h2 className="text-lg font-semibold text-foreground mb-1">Calificar trabajador</h2>
        <p className="text-sm text-muted-foreground mb-4">
          {asignacion.trabajador ? `${asignacion.trabajador.nombre} ${asignacion.trabajador.apellido}` : ''}
        </p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Calificación</label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map(n => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setCalificacion(n)}
                  className={`w-10 h-10 rounded-lg text-lg transition-colors ${
                    n <= calificacion ? 'bg-warning text-white' : 'bg-muted text-muted-foreground/60'
                  }`}
                >
                  ★
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Comentario (opcional)</label>
            <textarea
              rows={2}
              value={comentario}
              onChange={e => setComentario(e.target.value)}
              maxLength={500}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
            />
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="flex-1 border border-border hover:bg-muted text-sm font-medium py-2 rounded-lg transition-colors">Cancelar</button>
            <button type="submit" disabled={calificar.isPending} className="flex-1 bg-warning hover:bg-warning/80 disabled:opacity-50 text-white text-sm font-medium py-2 rounded-lg transition-colors">
              {calificar.isPending ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
