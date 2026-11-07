import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ArrowLeft, MapPin, Plus, Copy, Pencil } from 'lucide-react';
import { SkeletonDetail } from '@/shared/components/Skeleton';
import { ErrorState } from '@/shared/components/ErrorState';
import { EmptyState } from '@/shared/components/EmptyState';
import { ConfirmModal } from '@/shared/components/ConfirmModal';
import { fmtDate } from '@/shared/lib/format';
import { useCambiarEstadoGrupo, useGrupo } from '../hooks/useGrupos';
import { FaseChip } from '../components/FaseChip';
import { DuplicarTurnoModal } from '../components/DuplicarTurnoModal';
import { EditarGrupoModal } from '../components/EditarGrupoModal';
import { useOpcionesGrupos } from '@/modules/configuracion/hooks/useConfiguracion';
import { avisoDeCierre, subtituloGrupo, ultimoTurnoCopiable } from '../grupoUtils';

/** Detalle de un grupo: sus datos, sus turnos por fecha y las acciones rápidas (agregar, duplicar, cerrar). */
export function GrupoDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const grupoId = Number(id);
  const { data, isLoading, isError, error, refetch } = useGrupo(grupoId);
  const cambiarEstado = useCambiarEstadoGrupo();
  const [duplicando, setDuplicando] = useState(false);
  const [editando, setEditando] = useState(false);
  const { etiqueta } = useOpcionesGrupos();
  const [confirmandoCierre, setConfirmandoCierre] = useState(false);
  // Texto del aviso "hay contratos sin firmar": si el usuario insiste, se cierra igual.
  const [avisoPagos, setAvisoPagos] = useState<string | null>(null);

  if (isLoading) return <SkeletonDetail />;
  if (isError) return <ErrorState error={error} onRetry={refetch} />;
  const g = data?.data;
  if (!g) return <p className="text-muted-foreground text-sm py-12 text-center">Grupo no encontrado</p>;

  const cerrado = g.estado === 'cerrado';
  const ultimo = ultimoTurnoCopiable(g.turnos);

  return (
    <div>
      <button type="button" onClick={() => navigate('/grupos')} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors w-fit">
        <ArrowLeft size={16} /> Volver a Grupos
      </button>

      <div className="bg-card border border-border rounded-2xl p-5 mb-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h1 className="text-xl font-bold text-foreground">{g.nombre}</h1>
              <FaseChip fase={g.fase} />
            </div>
            <p className="text-sm text-muted-foreground">{subtituloGrupo(g)}</p>
            {g.lugar && <p className="flex items-center gap-1 text-sm text-muted-foreground mt-1"><MapPin size={14} aria-hidden="true" /> {g.lugar}</p>}
            {g.descripcion && <p className="text-sm text-foreground mt-2">{g.descripcion}</p>}
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <button type="button" onClick={() => setEditando(true)} className="flex items-center gap-1.5 border border-border hover:bg-muted text-sm font-medium px-3 py-2 rounded-lg transition-colors">
              <Pencil size={15} /> Editar
            </button>
            {!cerrado && (
              <>
                {ultimo && (
                  <button type="button" onClick={() => setDuplicando(true)} className="flex items-center gap-1.5 border border-border hover:bg-muted text-sm font-medium px-3 py-2 rounded-lg transition-colors">
                    <Copy size={15} /> Duplicar último
                  </button>
                )}
                <Link to={`/turnos?grupo=${g.id}`} className="flex items-center gap-1.5 border border-primary/30 bg-primary-50 text-primary-600 hover:bg-primary-100 text-sm font-medium px-3 py-2 rounded-lg transition-colors">
                  <Plus size={15} /> Agregar turno
                </Link>
              </>
            )}
          </div>
        </div>
      </div>

      <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">Turnos ({g.turnos.length})</h2>
      {g.turnos.length === 0 ? (
        <EmptyState title="Todavía no hay turnos" message="Usa «Agregar turno» para crear el primero." />
      ) : (
        <ul className="flex flex-col gap-2 mb-6">
          {g.turnos.map(t => {
            const cancelado = t.estado === 'cancelada';
            return (
              <li key={t.id}>
                <Link to={`/turnos/${t.id}`} className="block bg-card border border-border rounded-xl px-4 py-3 hover:border-primary/50 transition-colors">
                  <p className="text-xs font-semibold text-muted-foreground uppercase">{fmtDate(t.fecha)}</p>
                  <p className={`font-semibold ${cancelado ? 'text-muted-foreground line-through' : 'text-foreground'}`}>{t.titulo}</p>
                  <p className="text-sm text-muted-foreground">
                    {t.hora_inicio.slice(0, 5)}{t.hora_fin_estimada ? ` – ${t.hora_fin_estimada.slice(0, 5)}` : ''}{t.fin_dia_siguiente ? ' (día sig.)' : ''}
                    {cancelado ? ' · Cancelado' : ` · ${t.plazas_cubiertas} de ${t.plazas} plazas cubiertas`}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <button
        type="button"
        disabled={cambiarEstado.isPending}
        onClick={() => (cerrado ? cambiarEstado.mutate({ id: g.id, cerrar: false }) : setConfirmandoCierre(true))}
        className="text-sm font-medium text-muted-foreground hover:text-foreground border border-border hover:bg-muted rounded-lg px-3 py-2 transition-colors disabled:opacity-50"
      >
        {cerrado ? 'Reabrir grupo' : 'Cerrar grupo'}
      </button>

      {editando && <EditarGrupoModal grupo={g} etiqueta={etiqueta} onClose={() => setEditando(false)} />}
      {duplicando && ultimo && <DuplicarTurnoModal turno={ultimo} onClose={() => setDuplicando(false)} />}
      {confirmandoCierre && (
        <ConfirmModal
          title="Cerrar grupo"
          detail={`«${g.nombre}» saldrá de la lista de activos y ya no se podrán agregarle turnos. Puedes reabrirlo cuando quieras.`}
          confirmLabel="Cerrar"
          pending={cambiarEstado.isPending}
          onCancel={() => setConfirmandoCierre(false)}
          onConfirm={() => cambiarEstado.mutate(
            { id: g.id, cerrar: true },
            { onError: (err) => setAvisoPagos(avisoDeCierre(err)), onSettled: () => setConfirmandoCierre(false) },
          )}
        />
      )}
      {avisoPagos && (
        <ConfirmModal
          title="Hay pagos frenados"
          detail={avisoPagos}
          confirmLabel="Cerrar de todos modos"
          pending={cambiarEstado.isPending}
          onCancel={() => setAvisoPagos(null)}
          onConfirm={() => cambiarEstado.mutate({ id: g.id, cerrar: true, confirmar: true }, { onSettled: () => setAvisoPagos(null) })}
        />
      )}
    </div>
  );
}
