import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { MapPin } from 'lucide-react';
import { SkeletonTable } from '@/shared/components/Skeleton';
import { ErrorState } from '@/shared/components/ErrorState';
import { EmptyState } from '@/shared/components/EmptyState';
import { useOpcionesGrupos } from '@/modules/configuracion/hooks/useConfiguracion';
import { useGrupos } from '../hooks/useGrupos';
import { FaseChip } from '../components/FaseChip';
import { subtituloGrupo } from '../grupoUtils';
import type { EstadoGrupo } from '../types';

const PESTANAS: { value: EstadoGrupo; label: string }[] = [
  { value: 'activo', label: 'Activos' },
  { value: 'cerrado', label: 'Cerrados' },
];

/** Lista de grupos de turnos de la empresa: activos y cerrados. */
export function GruposPage() {
  const navigate = useNavigate();
  const [estado, setEstado] = useState<EstadoGrupo>('activo');
  const { usa, isLoading: cargandoOpciones } = useOpcionesGrupos();
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
            <Link to={`/grupos/${g.id}`} className="block bg-card border border-border rounded-2xl p-4 hover:border-primary/50 transition-colors h-full">
              <div className="flex items-start justify-between gap-2">
                <h2 className="font-bold text-foreground">{g.nombre}</h2>
                <FaseChip fase={g.fase} />
              </div>
              <p className="text-sm text-muted-foreground mt-1">{subtituloGrupo(g)}</p>
              {g.lugar && (
                <p className="flex items-center gap-1 text-xs text-muted-foreground mt-1.5 truncate">
                  <MapPin size={12} className="flex-shrink-0" aria-hidden="true" /> {g.lugar}
                </p>
              )}
            </Link>
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
    </div>
  );
}
