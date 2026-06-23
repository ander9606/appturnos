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
  borrador: 'bg-gray-100 text-gray-600',
  publicada: 'bg-blue-100 text-blue-700',
  en_progreso: 'bg-amber-100 text-amber-700',
  completada: 'bg-green-100 text-green-700',
  cancelada: 'bg-red-100 text-red-600',
};

const ESTADO_ASIG_BADGE: Record<EstadoAsignacion, string> = {
  pendiente: 'bg-gray-100 text-gray-600',
  confirmado: 'bg-blue-100 text-blue-700',
  en_progreso: 'bg-amber-100 text-amber-700',
  completado: 'bg-green-100 text-green-700',
  no_presentado: 'bg-red-100 text-red-600',
  cancelado: 'bg-gray-100 text-gray-400',
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

  if (loadingOferta) return <p className="text-gray-500 text-sm py-8 text-center">Cargando...</p>;
  if (!oferta) return <p className="text-gray-500 text-sm py-8 text-center">Oferta no encontrada</p>;

  return (
    <div>
      <button
        onClick={() => navigate('/turnos')}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-4 transition-colors"
      >
        <ArrowLeft size={16} /> Volver a Turnos
      </button>

      {/* Header card */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-1">{oferta.titulo}</h2>
            <p className="text-sm text-gray-500">
              {fmtDate(oferta.fecha)} · {oferta.hora_inicio}
              {oferta.hora_fin_estimada ? ` – ${oferta.hora_fin_estimada as string}` : ''}
              {oferta.lugar ? ` · ${oferta.lugar as string}` : ''}
            </p>
            {oferta.descripcion && <p className="text-sm text-gray-600 mt-2">{oferta.descripcion as string}</p>}
          </div>
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${ESTADO_OFERTA_BADGE[oferta.estado as EstadoOferta]}`}>
            {(oferta.estado as string).charAt(0).toUpperCase() + (oferta.estado as string).slice(1).replace('_', ' ')}
          </span>
        </div>
        {Array.isArray(oferta.puestos) && oferta.puestos.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {(oferta.puestos as Array<{ id: number; cargo_nombre: string; asignados: number; plazas: number; tarifa_dia: number }>).map(p => (
              <span key={p.id} className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-lg">
                {p.cargo_nombre} · {p.asignados}/{p.plazas} · {fmtCOP(p.tarifa_dia)}/día
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-gray-200">
        {(['asignaciones', 'puestos'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors capitalize ${
              tab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t === 'asignaciones' ? 'Asignaciones' : 'Puestos'}
          </button>
        ))}
      </div>

      {tab === 'puestos' && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-xs uppercase">
                <th className="text-left px-4 py-3 font-medium">Cargo</th>
                <th className="text-right px-4 py-3 font-medium">Plazas</th>
                <th className="text-right px-4 py-3 font-medium">Asignados</th>
                <th className="text-right px-4 py-3 font-medium">Tarifa/día</th>
                <th className="text-left px-4 py-3 font-medium">Notas</th>
              </tr>
            </thead>
            <tbody>
              {((oferta.puestos ?? []) as Array<{ id: number; cargo_nombre: string; plazas: number; asignados: number; tarifa_dia: number; notas: string | null }>).map(p => (
                <tr key={p.id} className="border-t border-gray-100">
                  <td className="px-4 py-3 text-gray-900">{p.cargo_nombre}</td>
                  <td className="px-4 py-3 text-right text-gray-600">{p.plazas}</td>
                  <td className="px-4 py-3 text-right text-gray-600">{p.asignados}</td>
                  <td className="px-4 py-3 text-right text-gray-600">{fmtCOP(p.tarifa_dia)}</td>
                  <td className="px-4 py-3 text-gray-500">{p.notas ?? '—'}</td>
                </tr>
              ))}
              {(!oferta.puestos || (oferta.puestos as unknown[]).length === 0) && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-gray-400 text-sm">Sin puestos</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'asignaciones' && (
        <div>
          <div className="flex gap-1 mb-4 border-b border-gray-200 overflow-x-auto">
            {estadoTabs.map(t => (
              <button
                key={String(t.value)}
                onClick={() => setFiltroEstado(t.value)}
                className={`px-3 py-2 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                  filtroEstado === t.value
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {loadingAsig ? (
            <p className="text-gray-500 text-sm py-8 text-center">Cargando...</p>
          ) : asignaciones.length === 0 ? (
            <p className="text-gray-500 text-sm py-8 text-center">Sin asignaciones</p>
          ) : (
            <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-gray-500 text-xs uppercase">
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
                    <tr key={a.id} className="border-t border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-900">
                        {a.trabajador ? `${a.trabajador.nombre} ${a.trabajador.apellido}` : String(a.trabajador_id)}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{a.puesto?.cargo_nombre ?? '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${ESTADO_ASIG_BADGE[a.estado]}`}>
                          {ESTADO_ASIG_LABEL[a.estado]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{a.hora_ingreso ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-600">{a.hora_egreso ?? '—'}</td>
                      <td className="px-4 py-3 text-right text-gray-600">
                        {a.calificacion !== null ? `${a.calificacion}★` : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 justify-end">
                          {a.estado === 'pendiente' && (
                            <>
                              <button onClick={() => confirmar.mutate(a.id)} className="text-xs text-green-600 hover:bg-green-50 px-2 py-1 rounded transition-colors">✓</button>
                              <button onClick={() => rechazar.mutate(a.id)} className="text-xs text-red-600 hover:bg-red-50 px-2 py-1 rounded transition-colors">✗</button>
                            </>
                          )}
                          {a.estado === 'confirmado' && (
                            <button onClick={() => cancelarAsig.mutate(a.id)} className="text-xs text-gray-500 hover:bg-gray-100 px-2 py-1 rounded transition-colors">Cancelar</button>
                          )}
                          {a.estado === 'completado' && (
                            <>
                              {a.calificacion === null && (
                                <button
                                  onClick={() => setCalificandoId(a.id)}
                                  className="flex items-center gap-1 text-xs text-amber-600 hover:bg-amber-50 px-2 py-1 rounded transition-colors"
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
                              className="text-xs text-red-500 hover:bg-red-50 px-2 py-1 rounded transition-colors"
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
      <div className="bg-white rounded-2xl p-6 w-full max-w-sm">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Calificar trabajador</h2>
        <p className="text-sm text-gray-500 mb-4">
          {asignacion.trabajador ? `${asignacion.trabajador.nombre} ${asignacion.trabajador.apellido}` : ''}
        </p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Calificación</label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map(n => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setCalificacion(n)}
                  className={`w-10 h-10 rounded-lg text-lg transition-colors ${
                    n <= calificacion ? 'bg-amber-400 text-white' : 'bg-gray-100 text-gray-400'
                  }`}
                >
                  ★
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Comentario (opcional)</label>
            <textarea
              rows={2}
              value={comentario}
              onChange={e => setComentario(e.target.value)}
              maxLength={500}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="flex-1 border border-gray-300 hover:bg-gray-50 text-sm font-medium py-2 rounded-lg transition-colors">Cancelar</button>
            <button type="submit" disabled={calificar.isPending} className="flex-1 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white text-sm font-medium py-2 rounded-lg transition-colors">
              {calificar.isPending ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
