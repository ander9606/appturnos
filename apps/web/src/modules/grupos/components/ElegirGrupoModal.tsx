import { useMemo, useState } from 'react';
import { Check, Plus, Search, X } from 'lucide-react';
import { Modal } from '@/shared/components/Modal';
import { EmptyState } from '@/shared/components/EmptyState';
import { ErrorState } from '@/shared/components/ErrorState';
import { SkeletonList } from '@/shared/components/Skeleton';
import { useGrupos } from '../hooks/useGrupos';
import { subtituloGrupo } from '../grupoUtils';
import type { GrupoTurno } from '../types';

interface Props {
  /** Cómo llama la empresa a un grupo ("Evento", "Obra"…): va de título, sin artículo, para que sirva con cualquier nombre. */
  etiqueta: string;
  seleccionadoId?: number;
  onSelect: (g: GrupoTurno) => void;
  onCrear: () => void;
  onClose: () => void;
}

/** Con pocos grupos buscar estorba: el buscador aparece desde este número. */
const MIN_PARA_BUSCAR = 6;

/** Lista de grupos activos para vincular un turno. Los cerrados no aparecen: no reciben turnos nuevos. */
export function ElegirGrupoModal({ etiqueta, seleccionadoId, onSelect, onCrear, onClose }: Props) {
  const [busqueda, setBusqueda] = useState('');
  const { data, isLoading, isError, error, refetch } = useGrupos('activo');
  const grupos = useMemo(() => data?.data ?? [], [data]);
  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return q ? grupos.filter(g => g.nombre.toLowerCase().includes(q)) : grupos;
  }, [grupos, busqueda]);

  return (
    <Modal onClose={onClose} padded={false} className="flex flex-col max-h-[80vh]">
      {/* Este modal vive dentro del formulario de la oferta: Enter en el buscador no debe enviarla. */}
      <div
        onKeyDown={e => { if (e.key === 'Enter' && (e.target as HTMLElement).tagName === 'INPUT') e.preventDefault(); }}
        className="flex flex-col min-h-0 flex-1"
      >
      <div className="flex items-center justify-between px-5 pt-5 pb-3">
        <h3 className="text-base font-semibold text-foreground">{etiqueta}</h3>
        <button type="button" onClick={onClose} aria-label="Cerrar" className="text-muted-foreground hover:text-foreground">
          <X size={18} />
        </button>
      </div>

      <button
        type="button"
        onClick={onCrear}
        aria-label={`Crear ${etiqueta}`}
        className="mx-5 mb-3 flex items-center gap-2 border border-primary/30 bg-primary-50 text-primary-600 rounded-lg px-3 py-2 text-sm font-medium hover:bg-primary-100 transition-colors"
      >
        <Plus size={16} /> Crear
      </button>

      {grupos.length >= MIN_PARA_BUSCAR && (
        <div className="mx-5 mb-3 flex items-center gap-2 border border-border rounded-lg px-3 py-2">
          <Search size={14} className="text-muted-foreground flex-shrink-0" />
          <input
            type="text"
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar…"
            aria-label="Buscar"
            className="flex-1 text-sm focus:outline-none"
          />
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-5 pb-5">
        {isLoading ? (
          <SkeletonList count={3} />
        ) : isError ? (
          <ErrorState error={error} onRetry={refetch} />
        ) : filtrados.length === 0 ? (
          grupos.length === 0
            ? <EmptyState title="Nada por aquí todavía" message="Crea el primero con «Crear»." />
            : <EmptyState title="Sin resultados" variant="search" />
        ) : (
          filtrados.map(g => {
            const activo = g.id === seleccionadoId;
            return (
              <button
                key={g.id}
                type="button"
                onClick={() => onSelect(g)}
                aria-pressed={activo}
                className="w-full flex items-center gap-3 py-2.5 border-b border-border last:border-0 text-left hover:bg-muted/50 transition-colors"
              >
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-medium text-foreground truncate">{g.nombre}</span>
                  <span className="block text-xs text-muted-foreground truncate">{subtituloGrupo(g)}</span>
                </span>
                {activo && <Check size={16} className="text-primary flex-shrink-0" />}
              </button>
            );
          })
        )}
      </div>
      </div>
    </Modal>
  );
}
