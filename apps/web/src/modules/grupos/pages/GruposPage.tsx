import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { MapPin, List, Pencil } from 'lucide-react';
import { SkeletonTable } from '@/shared/components/Skeleton';
import { ErrorState } from '@/shared/components/ErrorState';
import { EmptyState } from '@/shared/components/EmptyState';
import { useOpcionesGrupos } from '@/modules/configuracion/hooks/useConfiguracion';
import { useGrupos } from '../hooks/useGrupos';
import { FaseChip } from '../components/FaseChip';
import { EditarGrupoModal } from '../components/EditarGrupoModal';
import { subtituloGrupo } from '../grupoUtils';
import type { EstadoGrupo, GrupoTurno } from '../types';

const PESTANAS: { value: EstadoGrupo; label: string }[] = [
  { value: 'activo', label: 'Activos' },
  { value: 'cerrado', label: 'Cerrados' },
];

/** Lista de grupos de turnos de la empresa: activos y cerrados. */
export function GruposPage() {
  const navigate = useNavigate();
  const [estado, setEstado] = useState<EstadoGrupo>('activo');
  const { usa, etiqueta, isLoading: cargandoOpciones } = useOpcionesGrupos();
  const [editando, setEditando] = useState<GrupoTurno | null>(null);
  const { data, isLoading, isError, error, refetch } = useGrupos(estado, usa);
  const grupos = data?.data ?? [];

  const cuerpo = () => {
    if (cargandoOpciones || (usa && isLoading)) return <SkeletonTable rows={4} cols={3} />;
    if (!usa) {
      return <EmptyState title="Los grupos están apagados" message="Actívalos en Configuración para agrupar turnos de distintos días." />;
    }
    if (isError) return <ErrorState error={error} onRetry={refetch} />;
    if (grupos.length === 0) {
      return estado === 'activo'
        ? <EmptyState title="Todavía no hay nada" message="Crea el grupo desde «Nuevo turno» y aparecerá aquí." action={{ label: 'Nuevo turno', onClick: () => navigate('/turnos') }} />
        : <EmptyState variant="done" title="Nada cerrado" message="Los grupos que cierres quedarán guardados aquí." />;
    }
    return (
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {grupos.map(g => (
          <li key={g.id}>
            <div className="bg-card border border-border rounded-2xl overflow-hidden h-full flex flex-col hover:border-primary/50 transition-colors">
              <Link to={`/grupos/${g.id}`} className="block p-4 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="font-bold text-foreground">{g.nombre}</h2>
                  <FaseChip fase={g.fase} />
                </div>
                <p className="text-sm text-muted-foreground mt-1">{subtituloGrupo(g)}</p>
                {g.lugar && (
                  <p className="flex items-center gap-1 text-xs text-muted-foreground mt-1.5 truncate">
                    <MapPin size={12} className="flex-shrink-0" aria-hidden="true" /> {g.lugar_alias || g.lugar}
                  </p>
                )}
              </Link>
              <div className="flex border-t border-border">
                <Link
                  to={`/grupos/${g.id}`}
                  aria-label={`Ver turnos de ${g.nombre}`}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-semibold text-primary-700 hover:bg-primary-50 transition-colors"
                >
                  <List size={15} aria-hidden="true" /> {g.total_turnos === 1 ? 'Ver 1 turno' : `Ver ${g.total_turnos} turnos`}
                </Link>
                <button
                  type="button"
                  onClick={() => setEditando(g)}
                  aria-label={`Editar ${g.nombre}`}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-semibold text-muted-foreground hover:bg-muted border-l border-border transition-colors"
                >
                  <Pencil size={14} aria-hidden="true" /> Editar
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    );
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-4">Grupos de turnos</h1>
      <div className="flex gap-2 mb-5" role="tablist">
        {PESTANAS.map(p => (
          <button
            key={p.value}
            type="button"
            role="tab"
            aria-selected={estado === p.value}
            onClick={() => setEstado(p.value)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium border transition-colors ${
              estado === p.value ? 'bg-primary text-white border-primary' : 'bg-card text-foreground border-border hover:bg-muted'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
      {cuerpo()}
      {editando && <EditarGrupoModal grupo={editando} etiqueta={etiqueta} onClose={() => setEditando(null)} />}
    </div>
  );
}
