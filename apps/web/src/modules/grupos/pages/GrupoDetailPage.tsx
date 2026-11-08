import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ArrowLeft, MapPin, Plus, Copy, Pencil, Lock, LockOpen } from 'lucide-react';
import { SkeletonDetail } from '@/shared/components/Skeleton';
import { ErrorState } from '@/shared/components/ErrorState';
import { EmptyState } from '@/shared/components/EmptyState';
import { ConfirmModal } from '@/shared/components/ConfirmModal';
import { MenuAcciones, type AccionMenu } from '@/shared/components/MenuAcciones';
import { useCambiarEstadoGrupo, useGrupo } from '../hooks/useGrupos';
import { FaseChip } from '../components/FaseChip';
import { DuplicarTurnoModal } from '../components/DuplicarTurnoModal';
import { FilaTurno } from '../components/FilaTurno';
import { EditarGrupoModal } from '../components/EditarGrupoModal';
import { useOpcionesGrupos } from '@/modules/configuracion/hooks/useConfiguracion';
import { avisoDeCierre, rangoDeFechas, resumenPlazas, ultimoTurnoCopiable } from '../grupoUtils';

/** Detalle de un grupo: sus datos, sus turnos por fecha y las acciones rápidas (agregar, duplicar, cerrar). */
export function GrupoDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const grupoId = Number(id);
  const { data, isLoading, isError, error, refetch } = useGrupo(grupoId);
  const cambiarEstado = useCambiarEstadoGrupo();
  const [duplicando, setDuplicando] = useState(false);
  const [editando, setEditando] = useState(false);
  const { etiqueta, etiquetaPlural } = useOpcionesGrupos();
  const [confirmandoCierre, setConfirmandoCierre] = useState(false);
  // Texto del aviso "hay contratos sin firmar": si el usuario insiste, se cierra igual.
  const [avisoPagos, setAvisoPagos] = useState<string | null>(null);

  if (isLoading) return <SkeletonDetail />;
  if (isError) return <ErrorState error={error} onRetry={refetch} />;
  const g = data?.data;
  if (!g) return <p className="text-muted-foreground text-sm py-12 text-center">No se encontró</p>;

  const cerrado = g.estado === 'cerrado';
  const ultimo = ultimoTurnoCopiable(g.turnos);

  const plazas = resumenPlazas(g.turnos);
  const acciones: AccionMenu[] = [
    { key: 'editar', label: 'Editar', icon: <Pencil size={15} />, onSelect: () => setEditando(true) },
    ...(!cerrado && ultimo ? [{ key: 'duplicar', label: 'Duplicar último turno', icon: <Copy size={15} />, onSelect: () => setDuplicando(true) }] : []),
    {
      key: 'estado',
      label: `${cerrado ? 'Reabrir' : 'Cerrar'} ${etiqueta.toLowerCase()}`,
      icon: cerrado ? <LockOpen size={15} /> : <Lock size={15} />,
      disabled: cambiarEstado.isPending,
      onSelect: () => (cerrado ? cambiarEstado.mutate({ id: g.id, cerrar: false }) : setConfirmandoCierre(true)),
    },
  ];

  return (
    <div>
      <button type="button" onClick={() => navigate('/grupos')} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors w-fit">
        <ArrowLeft size={16} /> Volver a {etiquetaPlural}
      </button>

      {/* El nombre es el título de la página; las acciones secundarias van en el menú «⋯» y la principal junto a la lista. */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <h1 className="text-2xl font-bold text-foreground min-w-0 break-words">{g.nombre}</h1>
        <MenuAcciones etiqueta="Más opciones" acciones={acciones} />
      </div>

      <div className="bg-card border border-border rounded-2xl p-5 mb-6 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <FaseChip fase={g.fase} />
          <span className="text-sm text-muted-foreground">{rangoDeFechas(g) ?? 'Sin turnos todavía'}</span>
        </div>
        {g.lugar && <p className="flex items-center gap-1.5 text-sm text-foreground"><MapPin size={15} className="text-muted-foreground" aria-hidden="true" /> {g.lugar_alias || g.lugar}</p>}
        {g.descripcion && <p className="text-sm text-muted-foreground">{g.descripcion}</p>}
        {plazas.turnos > 0 && (
          <dl className="flex gap-10 border-t border-border pt-3">
            <div>
              <dd className="text-xl font-bold text-foreground">{plazas.turnos}</dd>
              <dt className="text-xs text-muted-foreground">{plazas.turnos === 1 ? 'turno' : 'turnos'}</dt>
            </div>
            <div>
              <dd className="text-xl font-bold text-foreground">{plazas.cubiertas}<span className="text-sm font-medium text-muted-foreground"> de {plazas.plazas}</span></dd>
              <dt className="text-xs text-muted-foreground">plazas cubiertas</dt>
            </div>
          </dl>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 mb-3">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Turnos ({g.turnos.length})</h2>
        {!cerrado && (
          <Link to={`/turnos?grupo=${g.id}`} className="flex items-center gap-1.5 bg-primary hover:bg-primary-600 text-white text-sm font-medium px-3 py-2 rounded-lg transition-colors">
            <Plus size={15} aria-hidden="true" /> Agregar turno
          </Link>
        )}
      </div>
      {g.turnos.length === 0 ? (
        <EmptyState title="Todavía no hay turnos" message="Usa «Agregar turno» para crear el primero." />
      ) : (
        <ul className="flex flex-col gap-2">
          {g.turnos.map(t => <li key={t.id}><FilaTurno turno={t} /></li>)}
        </ul>
      )}

      {editando && <EditarGrupoModal grupo={g} etiqueta={etiqueta} onClose={() => setEditando(false)} />}
      {duplicando && ultimo && <DuplicarTurnoModal turno={ultimo} onClose={() => setDuplicando(false)} />}
      {confirmandoCierre && (
        <ConfirmModal
          title={`Cerrar ${etiqueta.toLowerCase()}`}
          detail={`«${g.nombre}» saldrá de la lista de activos y ya no se podrán agregar turnos. Puedes reabrir cuando quieras.`}
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
