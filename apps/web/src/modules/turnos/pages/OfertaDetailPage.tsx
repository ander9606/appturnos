import { useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { ArrowLeft, Plus, Pencil, Trash2, Star, Send, Zap, CheckCircle2, Clock, AlertTriangle, X, Download, Loader2 } from 'lucide-react';
import {
  useOferta,
  useAsignaciones,
  usePuestos,
  useCrearPuesto,
  useActualizarPuesto,
  useEliminarPuesto,
  usePublicarOferta,
  useCompletarOferta,
  useConfirmarAsignacion,
  useRechazarAsignacion,
  useCancelarAsignacion,
  useNoPresentado,
  useCorregirAsignacion,
  useCalificar,
  useDescartarSospechosoAsignacion,
} from '../hooks/useTurnos';
import { useCargos } from '@/modules/configuracion/hooks/useConfiguracion';
import { turnosApi } from '../api/turnosApi';
import { descargarBlob } from '@/shared/lib/download';
import { toast } from 'sonner';
import { ErrorState } from '@/shared/components/ErrorState';
import { Modal } from '@/shared/components/Modal';
import { ConfirmModal } from '@/shared/components/ConfirmModal';
import { useConfirm } from '@/shared/hooks/useConfirm';
import type { EstadoAsignacion, EstadoOferta, Asignacion, Puesto } from '../types';
import { fmtDate, fmtCOP } from '@/shared/lib/format';

const ESTADO_OFERTA_BADGE: Record<EstadoOferta, string> = {
  borrador: 'bg-muted text-muted-foreground',
  abierta: 'bg-primary-100 text-primary-600',
  publicada: 'bg-primary-100 text-primary-600',
  en_proceso: 'bg-warning-light text-warning',
  cerrada: 'bg-muted text-muted-foreground',
  completada: 'bg-success-light text-success',
  cancelada: 'bg-danger-light text-danger',
};

const ESTADO_OFERTA_LABEL: Record<EstadoOferta, string> = {
  borrador: 'Borrador', abierta: 'Abierta', publicada: 'Publicada', en_proceso: 'En progreso',
  cerrada: 'Cerrada', completada: 'Completada', cancelada: 'Cancelada',
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

const FILTROS_ASIG: { label: string; value: EstadoAsignacion | undefined }[] = [
  { label: 'Todas', value: undefined },
  { label: 'Pendientes', value: 'pendiente' },
  { label: 'Confirmadas', value: 'confirmado' },
  { label: 'Completadas', value: 'completado' },
  { label: 'No presentados', value: 'no_presentado' },
];

export function OfertaDetailPage() {
  const { id } = useParams<{ id: string }>();
  const ofertaId = Number(id);
  const navigate = useNavigate();

  const [filtroAsig, setFiltroAsig] = useState<EstadoAsignacion | undefined>(undefined);
  const [soloSospechosos, setSoloSospechosos] = useState(false);
  const [puestoEditando, setPuestoEditando] = useState<Puesto | null>(null);
  const [showPuestoForm, setShowPuestoForm] = useState(false);
  const [calificandoId, setCalificandoId] = useState<number | null>(null);
  const [corrigiendoAsig, setCorrigiendoAsig] = useState<Asignacion | null>(null);
  const [descargandoContratoId, setDescargandoContratoId] = useState<number | null>(null);

  async function handleDescargarContrato(asignacionId: number) {
    setDescargandoContratoId(asignacionId);
    try {
      const blob = await turnosApi.descargarContratoPorAsignacion(asignacionId);
      descargarBlob(blob, `contrato-turno-${asignacionId}.pdf`);
    } catch {
      toast.error('No se pudo descargar el contrato.');
    } finally {
      setDescargandoContratoId(null);
    }
  }

  const { data: ofertaData, isLoading, isError, error, refetch } = useOferta(ofertaId);
  const oferta = ofertaData?.data;
  const { confirmState, confirm, close } = useConfirm();

  const { data: puestosData } = usePuestos(ofertaId);
  const puestos: Puesto[] = puestosData?.data ?? oferta?.puestos ?? [];

  const { data: asigData, isLoading: loadingAsig } = useAsignaciones({
    oferta_id: ofertaId,
    estado: soloSospechosos ? undefined : filtroAsig,
    sospechoso: soloSospechosos || undefined,
  });
  const asignaciones: Asignacion[] = asigData?.data?.data ?? [];

  // Conteo de sospechosos independiente del filtro de estado — para mostrar el badge del toggle.
  const { data: sospechososData } = useAsignaciones({ oferta_id: ofertaId, sospechoso: true, limit: 1 });
  const totalSospechosos = sospechososData?.data?.pagination?.total ?? 0;

  const eliminarPuesto = useEliminarPuesto();
  const publicar = usePublicarOferta();
  const completar = useCompletarOferta();
  const confirmar = useConfirmarAsignacion();
  const rechazar = useRechazarAsignacion();
  const cancelarAsig = useCancelarAsignacion();
  const noPresentado = useNoPresentado();
  const descartarSospechoso = useDescartarSospechosoAsignacion();

  const calificandoAsig = calificandoId !== null
    ? asignaciones.find(a => a.id === calificandoId) ?? null
    : null;

  const canEditPuestos = oferta?.estado === 'borrador' || oferta?.estado === 'abierta';

  if (isLoading) return <p className="text-muted-foreground text-sm py-12 text-center">Cargando...</p>;
  if (isError) return <ErrorState error={error} onRetry={refetch} />;
  if (!oferta) return <p className="text-muted-foreground text-sm py-12 text-center">Oferta no encontrada</p>;

  return (
    <div className="flex flex-col h-full">
      {/* Back + Header */}
      <button
        onClick={() => navigate('/turnos')}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors w-fit"
      >
        <ArrowLeft size={16} /> Volver a Turnos
      </button>

      <div className="bg-card border border-border rounded-2xl p-5 mb-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <h1 className="text-xl font-bold text-foreground truncate">{oferta.titulo}</h1>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${ESTADO_OFERTA_BADGE[oferta.estado as EstadoOferta]}`}>
                {ESTADO_OFERTA_LABEL[oferta.estado as EstadoOferta]}
              </span>
              {oferta.external_ref && (
                <span
                  className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-primary-100 text-primary-600 flex-shrink-0"
                  title={oferta.external_ref}
                >
                  <Zap size={11} /> logiq360
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {fmtDate(oferta.fecha)} · {oferta.hora_inicio}
              {oferta.hora_fin_estimada ? ` – ${oferta.hora_fin_estimada}` : ''}
              {oferta.lugar ? ` · ${oferta.lugar}` : ''}
              {oferta.latitud != null && oferta.longitud != null && (
                <>
                  {' · '}
                  <a
                    href={`https://maps.google.com/?q=${oferta.latitud},${oferta.longitud}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary hover:underline"
                  >
                    Ver mapa
                  </a>
                </>
              )}
            </p>
            {oferta.descripcion && (
              <p className="text-sm text-muted-foreground mt-1">{oferta.descripcion}</p>
            )}
            {oferta.externo_notas && (
              <p className="text-sm text-foreground bg-muted rounded-lg px-3 py-2 mt-2">
                <span className="font-medium">Instrucciones para el operario: </span>
                {oferta.externo_notas}
              </p>
            )}
          </div>
          <div className="flex-shrink-0 flex flex-col items-end gap-2">
            <div className="text-right">
              <p className="text-2xl font-bold text-foreground">
                {puestos.reduce((s, p) => s + p.plazas_cubiertas, 0)}/{puestos.reduce((s, p) => s + p.plazas, 0)}
              </p>
              <p className="text-xs text-muted-foreground">asignados</p>
            </div>
            {oferta.estado === 'borrador' && (
              <button
                onClick={() => {
                  if (puestos.length === 0) {
                    toast.error('Agrega al menos un puesto antes de publicar.');
                    return;
                  }
                  confirm({
                    title: 'Publicar oferta',
                    detail: 'Será visible para el pool de trabajadores que califican para sus puestos.',
                    confirmLabel: 'Publicar',
                    onConfirm: () => { publicar.mutate(ofertaId); close(); },
                  });
                }}
                disabled={publicar.isPending}
                className="flex items-center gap-1.5 bg-primary hover:bg-primary-600 disabled:opacity-50 text-white text-sm font-medium px-3 py-1.5 rounded-lg transition-colors"
              >
                <Send size={14} /> {publicar.isPending ? 'Publicando...' : 'Publicar oferta'}
              </button>
            )}
            {!['borrador', 'completada', 'cancelada'].includes(oferta.estado) && (
              <button
                onClick={() => confirm({
                  title: 'Marcar como completada',
                  detail: 'Úsalo cuando el turno ya terminó en la realidad, sin importar si todas las asignaciones están cerradas en el sistema.',
                  confirmLabel: 'Marcar completada',
                  onConfirm: () => { completar.mutate(ofertaId); close(); },
                })}
                disabled={completar.isPending}
                className="flex items-center gap-1.5 bg-success hover:bg-success/90 disabled:opacity-50 text-white text-sm font-medium px-3 py-1.5 rounded-lg transition-colors"
              >
                <CheckCircle2 size={14} /> {completar.isPending ? 'Marcando...' : 'Marcar completada'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="flex gap-5 flex-1 min-h-0">

        {/* LEFT — Puestos */}
        <div className="w-80 flex-shrink-0 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">Puestos</h2>
            {canEditPuestos && (
              <button
                onClick={() => { setPuestoEditando(null); setShowPuestoForm(true); }}
                className="flex items-center gap-1 text-xs text-primary hover:text-primary-600 font-medium transition-colors"
              >
                <Plus size={13} /> Agregar
              </button>
            )}
          </div>

          {puestos.length === 0 ? (
            <div className="bg-card border border-dashed border-border rounded-2xl p-6 text-center">
              <p className="text-sm text-muted-foreground">Sin puestos</p>
              {canEditPuestos && (
                <button
                  onClick={() => { setPuestoEditando(null); setShowPuestoForm(true); }}
                  className="mt-2 text-xs text-primary hover:text-primary-600 font-medium"
                >
                  + Agregar el primero
                </button>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {puestos.map(p => (
                <div key={p.id} className="bg-card border border-border rounded-xl p-3.5">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <p className="text-sm font-semibold text-foreground">{p.cargo_nombre}</p>
                    {canEditPuestos && (
                      <div className="flex gap-1 flex-shrink-0">
                        <button
                          onClick={() => { setPuestoEditando(p); setShowPuestoForm(true); }}
                          className="text-muted-foreground/50 hover:text-primary transition-colors"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          onClick={() => confirm({
                            title: 'Eliminar puesto',
                            detail: `¿Eliminar el puesto "${p.cargo_nombre}"? Esta acción no se puede deshacer.`,
                            confirmLabel: 'Eliminar',
                            onConfirm: () => { eliminarPuesto.mutate({ ofertaId, puestoId: p.id }); close(); },
                          })}
                          className="text-muted-foreground/50 hover:text-danger transition-colors"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{fmtCOP(p.tarifa_dia)}/día</span>
                    <span className={`font-medium ${p.plazas_cubiertas >= p.plazas ? 'text-success' : 'text-foreground'}`}>
                      {p.plazas_cubiertas}/{p.plazas} plazas
                    </span>
                  </div>
                  {p.notas && (
                    <p className="text-xs text-muted-foreground/70 mt-1.5 truncate">{p.notas}</p>
                  )}
                  {/* Fill bar */}
                  <div className="mt-2 h-1 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: p.plazas > 0 ? `${Math.min(100, (p.plazas_cubiertas / p.plazas) * 100)}%` : '0%' }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* RIGHT — Asignaciones */}
        <div className="flex-1 min-w-0 flex flex-col">
          <div className="flex items-center justify-between mb-3 gap-2">
            <h2 className="text-sm font-semibold text-foreground">Asignaciones</h2>
            <div className="flex items-center gap-2">
              {(totalSospechosos > 0 || soloSospechosos) && (
                <button
                  onClick={() => setSoloSospechosos(v => !v)}
                  className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg border transition-colors ${
                    soloSospechosos
                      ? 'bg-warning-light text-warning border-warning/40'
                      : 'border-border text-muted-foreground hover:text-warning hover:border-warning/40'
                  }`}
                >
                  <AlertTriangle size={12} /> Sospechosos ({totalSospechosos})
                </button>
              )}
              <span className="text-xs text-muted-foreground">{asignaciones.length} resultado{asignaciones.length !== 1 ? 's' : ''}</span>
            </div>
          </div>

          <div className={`flex gap-1 mb-3 border-b border-border overflow-x-auto ${soloSospechosos ? 'opacity-40 pointer-events-none' : ''}`}>
            {FILTROS_ASIG.map(f => (
              <button
                key={String(f.value)}
                onClick={() => setFiltroAsig(f.value)}
                className={`px-3 py-2 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                  filtroAsig === f.value
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {loadingAsig ? (
            <p className="text-muted-foreground text-sm py-8 text-center">Cargando...</p>
          ) : asignaciones.length === 0 ? (
            <p className="text-muted-foreground text-sm py-8 text-center">Sin asignaciones</p>
          ) : (
            <div className="bg-card border border-border rounded-xl overflow-auto flex-1">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-card z-10">
                  <tr className="bg-muted text-muted-foreground text-xs uppercase border-b border-border">
                    <th className="text-left px-4 py-3 font-medium">Trabajador</th>
                    <th className="text-left px-4 py-3 font-medium">Puesto</th>
                    <th className="text-left px-4 py-3 font-medium">Estado</th>
                    <th className="text-left px-4 py-3 font-medium">Ingreso</th>
                    <th className="text-left px-4 py-3 font-medium">Egreso</th>
                    <th className="text-center px-4 py-3 font-medium">Cal.</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {asignaciones.map(a => (
                    <tr key={a.id} className="border-t border-border/60 hover:bg-muted transition-colors">
                      <td className="px-4 py-3 font-medium text-foreground">
                        {a.trabajador_nombre} {a.trabajador_apellido}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{a.cargo_nombre}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${ESTADO_ASIG_BADGE[a.estado]}`}>
                          {ESTADO_ASIG_LABEL[a.estado]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        <span className="inline-flex items-center gap-1.5">
                          {a.hora_ingreso_real ?? '—'}
                          {a.sospechoso === 1 && (
                            <AlertTriangle size={13} className="text-warning shrink-0">
                              <title>Marcaje sospechoso: mismo dispositivo y ubicación que otro trabajador</title>
                            </AlertTriangle>
                          )}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{a.hora_egreso_real ?? '—'}</td>
                      <td className="px-4 py-3 text-center text-muted-foreground">
                        {a.calificacion != null ? (
                          <span className="text-warning font-medium">{a.calificacion}★</span>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 justify-end">
                          {a.estado === 'pendiente' && (
                            <>
                              <button
                                onClick={() => confirmar.mutate(a.id)}
                                className="text-xs text-success hover:bg-success-light px-2 py-1 rounded transition-colors font-medium"
                              >
                                Confirmar
                              </button>
                              <button
                                onClick={() => confirm({
                                  title: 'Rechazar postulación',
                                  detail: `¿Rechazar la postulación de ${a.trabajador_nombre} ${a.trabajador_apellido}?`,
                                  confirmLabel: 'Rechazar',
                                  onConfirm: () => { rechazar.mutate(a.id); close(); },
                                })}
                                className="text-xs text-danger hover:bg-danger-light px-2 py-1 rounded transition-colors"
                              >
                                Rechazar
                              </button>
                            </>
                          )}
                          {a.estado === 'confirmado' && (
                            <button
                              onClick={() => confirm({
                                title: 'Cancelar asignación',
                                detail: `¿Cancelar la asignación confirmada de ${a.trabajador_nombre} ${a.trabajador_apellido}?`,
                                confirmLabel: 'Cancelar asignación',
                                onConfirm: () => { cancelarAsig.mutate(a.id); close(); },
                              })}
                              className="text-xs text-muted-foreground hover:bg-muted px-2 py-1 rounded transition-colors"
                            >
                              Cancelar
                            </button>
                          )}
                          {(a.estado === 'confirmado' || a.estado === 'en_progreso') && (
                            <button
                              onClick={() => confirm({
                                title: 'Marcar como no presentado',
                                detail: `¿Marcar a ${a.trabajador_nombre} ${a.trabajador_apellido} como no presentado? Esto puede afectar su ranking.`,
                                confirmLabel: 'Marcar no presentado',
                                onConfirm: () => { noPresentado.mutate(a.id); close(); },
                              })}
                              className="text-xs text-danger hover:bg-danger-light px-2 py-1 rounded transition-colors"
                            >
                              NP
                            </button>
                          )}
                          {a.estado === 'completado' && a.calificacion == null && (
                            <button
                              onClick={() => setCalificandoId(a.id)}
                              className="flex items-center gap-1 text-xs text-warning hover:bg-warning-light px-2 py-1 rounded transition-colors"
                            >
                              <Star size={11} /> Calificar
                            </button>
                          )}
                          {a.estado === 'completado' && (
                            <button
                              onClick={() => handleDescargarContrato(a.id)}
                              disabled={descargandoContratoId === a.id}
                              className="text-muted-foreground/60 hover:text-info transition-colors p-1 disabled:opacity-50"
                              title="Descargar contrato"
                              aria-label="Descargar contrato"
                            >
                              {descargandoContratoId === a.id
                                ? <Loader2 size={13} className="animate-spin" />
                                : <Download size={13} />}
                            </button>
                          )}
                          {(a.estado === 'confirmado' || a.estado === 'en_progreso' || a.estado === 'completado') && (
                            <button
                              onClick={() => setCorrigiendoAsig(a)}
                              className="text-muted-foreground/60 hover:text-info transition-colors p-1"
                              title="Corregir ingreso/egreso"
                              aria-label="Corregir ingreso/egreso"
                            >
                              <Clock size={13} />
                            </button>
                          )}
                          {a.sospechoso === 1 && (
                            <button
                              onClick={() => descartarSospechoso.mutate(a.id)}
                              disabled={descartarSospechoso.isPending}
                              className="text-warning/70 hover:text-warning transition-colors p-1 disabled:opacity-50"
                              title="Descartar: ya lo revisé, no es fraude"
                              aria-label="Descartar marcaje sospechoso"
                            >
                              <X size={13} />
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
      </div>

      {showPuestoForm && (
        <PuestoFormModal
          ofertaId={ofertaId}
          puesto={puestoEditando}
          onClose={() => { setShowPuestoForm(false); setPuestoEditando(null); }}
        />
      )}

      {calificandoAsig && (
        <CalificarModal
          asignacion={calificandoAsig}
          onClose={() => setCalificandoId(null)}
        />
      )}

      {corrigiendoAsig && (
        <CorregirAsignacionModal
          asignacion={corrigiendoAsig}
          onClose={() => setCorrigiendoAsig(null)}
        />
      )}

      {confirmState && (
        <ConfirmModal
          title={confirmState.title}
          detail={confirmState.detail}
          confirmLabel={confirmState.confirmLabel ?? 'Confirmar'}
          onConfirm={confirmState.onConfirm}
          onCancel={close}
        />
      )}
    </div>
  );
}

/* ── Puesto form modal ── */
function PuestoFormModal({
  ofertaId, puesto, onClose,
}: { ofertaId: number; puesto: Puesto | null; onClose: () => void }) {
  const { data: cargosData } = useCargos();
  const cargos = cargosData?.data ?? [];
  const crear = useCrearPuesto();
  const actualizar = useActualizarPuesto();

  const [form, setForm] = useState({
    cargo_id: puesto ? String(puesto.cargo_id) : '',
    plazas: puesto ? String(puesto.plazas) : '1',
    tarifa_dia: puesto ? String(puesto.tarifa_dia) : '',
    notas: puesto?.notas ?? '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (puesto) {
      await actualizar.mutateAsync({
        ofertaId,
        puestoId: puesto.id,
        plazas: Number(form.plazas),
        tarifa_dia: Number(form.tarifa_dia),
        notas: form.notas || null,
      });
    } else {
      await crear.mutateAsync({
        ofertaId,
        cargo_id: Number(form.cargo_id),
        plazas: Number(form.plazas),
        tarifa_dia: Number(form.tarifa_dia),
        notas: form.notas || undefined,
      });
    }
    onClose();
  };

  const isPending = crear.isPending || actualizar.isPending;

  return (
    <Modal onClose={onClose} size="sm">
      <h2 className="text-lg font-semibold text-foreground mb-4">
        {puesto ? 'Editar puesto' : 'Nuevo puesto'}
      </h2>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Cargo *</label>
          <select
            required
            disabled={!!puesto}
            value={form.cargo_id}
            onChange={e => setForm(f => ({ ...f, cargo_id: e.target.value }))}
            className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:bg-muted disabled:text-muted-foreground"
          >
            <option value="">Seleccionar cargo...</option>
            {cargos.filter(c => c.activo).map(c => (
              <option key={c.id} value={c.id}>{c.nombre}</option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Plazas *</label>
            <input
              required
              type="number"
              min="1"
              value={form.plazas}
              onChange={e => setForm(f => ({ ...f, plazas: e.target.value }))}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Tarifa/día (COP) *</label>
            <input
              required
              type="number"
              min="0"
              step="any"
              value={form.tarifa_dia}
              onChange={e => setForm(f => ({ ...f, tarifa_dia: e.target.value }))}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Notas</label>
          <input
            type="text"
            maxLength={255}
            value={form.notas}
            onChange={e => setForm(f => ({ ...f, notas: e.target.value }))}
            className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>
        <div className="flex gap-2 pt-2">
          <button type="button" onClick={onClose} className="flex-1 border border-border hover:bg-muted text-sm font-medium py-2 rounded-lg transition-colors">
            Cancelar
          </button>
          <button type="submit" disabled={isPending} className="flex-1 bg-primary hover:bg-primary-600 disabled:opacity-50 text-white text-sm font-medium py-2 rounded-lg transition-colors">
            {isPending ? 'Guardando...' : puesto ? 'Guardar' : 'Agregar'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/* ── Corregir ingreso/egreso ── */
// Sin conversión vía Date/toISOString a propósito — el valor de datetime-local
// ya es hora local sin timezone, y el backend guarda el string tal cual llega
// (mismo criterio que ahoraColombiaSQL() en el backend: evita desfases de zona horaria).
function toDatetimeLocal(s: string | null): string {
  return s ? s.replace(' ', 'T').slice(0, 16) : '';
}
function fromDatetimeLocal(v: string): string | undefined {
  if (!v) return undefined;
  return v.length === 16 ? `${v}:00` : v;
}

function CorregirAsignacionModal({ asignacion, onClose }: { asignacion: Asignacion; onClose: () => void }) {
  const corregir = useCorregirAsignacion();
  const [ingreso, setIngreso] = useState(toDatetimeLocal(asignacion.hora_ingreso_real));
  const [egreso, setEgreso] = useState(toDatetimeLocal(asignacion.hora_egreso_real));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (ingreso && egreso && egreso <= ingreso) {
      toast.error('La hora de egreso debe ser posterior al ingreso');
      return;
    }
    await corregir.mutateAsync({
      id: asignacion.id,
      // Vacío → se omite del body (no `null`): el backend solo distingue "no venía en
      // la petición" vía `!== undefined` — enviar null falla la validación isISO8601().
      hora_ingreso_real: fromDatetimeLocal(ingreso),
      hora_egreso_real: fromDatetimeLocal(egreso),
    });
    onClose();
  };

  return (
    <Modal onClose={onClose} size="sm">
      <h2 className="text-lg font-semibold text-foreground mb-1">Corregir ingreso/egreso</h2>
      <p className="text-sm text-muted-foreground mb-4">
        {asignacion.trabajador_nombre} {asignacion.trabajador_apellido} · {asignacion.cargo_nombre}
      </p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Ingreso</label>
          <input
            type="datetime-local"
            value={ingreso}
            onChange={e => setIngreso(e.target.value)}
            className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Egreso</label>
          <input
            type="datetime-local"
            value={egreso}
            onChange={e => setEgreso(e.target.value)}
            className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Dejar un campo vacío no lo modifica. Con ambos definidos, el turno se marca completado y recalcula el pago.
        </p>
        <div className="flex gap-2 pt-2">
          <button type="button" onClick={onClose} className="flex-1 border border-border hover:bg-muted text-sm font-medium py-2 rounded-lg transition-colors">
            Cancelar
          </button>
          <button type="submit" disabled={corregir.isPending} className="flex-1 bg-primary hover:bg-primary-600 disabled:opacity-50 text-white text-sm font-medium py-2 rounded-lg transition-colors">
            {corregir.isPending ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/* ── Calificar modal ── */
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
    <Modal onClose={onClose} size="sm">
      <h2 className="text-lg font-semibold text-foreground mb-1">Calificar trabajador</h2>
      <p className="text-sm text-muted-foreground mb-4">
        {asignacion.trabajador_nombre} {asignacion.trabajador_apellido}
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
                className={`w-10 h-10 rounded-lg text-lg transition-colors ${n <= calificacion ? 'bg-warning text-white' : 'bg-muted text-muted-foreground/60'}`}
              >
                ★
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Comentario</label>
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
    </Modal>
  );
}
