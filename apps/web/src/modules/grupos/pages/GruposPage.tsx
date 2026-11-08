import { useState } from 'react';
import { useNavigate } from 'react-router';
import { ChevronDown, ChevronUp, MapPin, Pencil } from 'lucide-react';
import { SkeletonTable } from '@/shared/components/Skeleton';
import { ErrorState } from '@/shared/components/ErrorState';
import { EmptyState } from '@/shared/components/EmptyState';
import { useOpcionesGrupos } from '@/modules/configuracion/hooks/useConfiguracion';
import { useGrupos } from '../hooks/useGrupos';
import { FaseChip } from '../components/FaseChip';
import { EditarGrupoModal } from '../components/EditarGrupoModal';
import { TurnosDelGrupo } from '../components/TurnosDelGrupo';
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
  const { usa, etiqueta, etiquetaPlural, isLoading: cargandoOpciones } = useOpcionesGrupos();
  const [editando, setEditando] = useState<GrupoTurno | null>(null);
  // Grupos desplegados (se pueden ver varios a la vez).
  const [abiertos, setAbiertos] = useState<number[]>([]);
  const alternar = (id: number) => setAbiertos(a => (a.includes(id) ? a.filter(x => x !== id) : [...a, id]));
  const { data, isLoading, isError, error, refetch } = useGrupos(estado, usa);
  const grupos = data?.data ?? [];

  const cuerpo = () => {
    if (cargandoOpciones || (usa && isLoading)) return <SkeletonTable rows={4} cols={3} />;
    if (!usa) {
      return <EmptyState title={`«${etiquetaPlural}» está apagado`} message="Actívalo en Configuración para agrupar turnos de distintos días." />;
    }
    if (isError) return <ErrorState error={error} onRetry={refetch} />;
    if (grupos.length === 0) {
      return estado === 'activo'
        ? <EmptyState title="Todavía no hay nada" message="Se crean desde «Nuevo turno» y aparecerán aquí." action={{ label: 'Nuevo turno', onClick: () => navigate('/turnos') }} />
        : <EmptyState variant="done" title="Nada cerrado" message="Lo que cierres quedará guardado aquí." />;
    }
    return (
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {grupos.map(g => {
          const abierto = abiertos.includes(g.id);
          const etiquetaVer = abierto ? 'Ocultar turnos' : g.total_turnos === 1 ? 'Ver 1 turno' : `Ver ${g.total_turnos} turnos`;
          return (
            // Desplegada ocupa todo el ancho de la fila para que los turnos respiren.
            <li key={g.id} className={abierto ? 'sm:col-span-2 xl:col-span-3' : ''}>
              <div className="bg-card border border-border rounded-2xl overflow-hidden h-full flex flex-col hover:border-primary/50 transition-colors">
                {/* Un solo toque abre o cierra la tarjeta (el chevron lo indica); el lápiz edita sin abrirla. */}
                <div className="relative flex-1">
                  <button
                    type="button"
                    onClick={() => alternar(g.id)}
                    aria-expanded={abierto}
                    aria-label={`${etiquetaVer} de ${g.nombre}`}
                    className="block w-full text-left p-4 pr-20 h-full"
                  >
                    <h2 className="font-bold text-foreground">{g.nombre}</h2>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-2">
                      <FaseChip fase={g.fase} />
                      <span className="text-sm text-muted-foreground">{subtituloGrupo(g)}</span>
                    </div>
                    {g.lugar && (
                      <p className="flex items-center gap-1 text-xs text-muted-foreground mt-2 truncate">
                        <MapPin size={12} className="flex-shrink-0" aria-hidden="true" /> {g.lugar_alias || g.lugar}
                      </p>
                    )}
                    <span className="absolute top-4 right-4 text-muted-foreground" aria-hidden="true">
                      {abierto ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditando(g)}
                    aria-label={`Editar ${g.nombre}`}
                    className="absolute top-3 right-11 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  >
                    <Pencil size={16} aria-hidden="true" />
                  </button>
                </div>
                {abierto && <TurnosDelGrupo grupoId={g.id} estado={g.estado} />}
              </div>
            </li>
          );
        })}
      </ul>
    );
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-4">{etiquetaPlural}</h1>
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
