import { useMemo, useState } from 'react';
import { Check, Plus, Search, X } from 'lucide-react';
import { Modal } from '@/shared/components/Modal';
import { EmptyState } from '@/shared/components/EmptyState';
import { ErrorState } from '@/shared/components/ErrorState';
import { SkeletonList } from '@/shared/components/Skeleton';
import { useGrupos } from '../hooks/useGrupos';
import { bogotaToday, fmtDate } from '@/shared/lib/format';
import { coincideBusqueda, grupoEnPeriodo, periodoDeFecha, subtituloGrupo } from '../grupoUtils';
import type { GrupoTurno } from '../types';

interface Props {
  /** Cómo llama la empresa a un grupo ("Evento", "Obra"…): va de título, sin artículo, para que sirva con cualquier nombre. */
  etiqueta: string;
  seleccionadoId?: number;
  /** Fecha del turno (YYYY-MM-DD): define el período de facturación que se muestra por defecto. Sin ella, hoy. */
  fecha?: string;
  onSelect: (g: GrupoTurno) => void;
  onCrear: () => void;
  onClose: () => void;
}

/** Con pocos grupos buscar estorba: el buscador aparece desde este número. */
const MIN_PARA_BUSCAR = 6;

/** Lista de grupos activos para vincular un turno. Los cerrados no aparecen: no reciben turnos nuevos. */
export function ElegirGrupoModal({ etiqueta, seleccionadoId, fecha, onSelect, onCrear, onClose }: Props) {
  const [busqueda, setBusqueda] = useState('');
  const [verTodos, setVerTodos] = useState(false);
  const { data, isLoading, isError, error, refetch } = useGrupos('activo');
  const grupos = useMemo(() => data?.data ?? [], [data]);
  const periodo = useMemo(() => periodoDeFecha(fecha || bogotaToday()), [fecha]);
  const buscando = busqueda.trim() !== '';
  // Por defecto solo los grupos con turnos en el período: con cientos de grupos el resto es ruido. Buscar o «Ver todos» llega a cualquiera.
  const filtrados = useMemo(() => {
    if (buscando) return grupos.filter(g => coincideBusqueda(g, busqueda));
    if (verTodos) return grupos;
    return grupos.filter(g => grupoEnPeriodo(g, periodo) || g.id === seleccionadoId);
  }, [grupos, busqueda, buscando, verTodos, periodo, seleccionadoId]);
  const ocultos = grupos.length - filtrados.length;

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

      {(grupos.length >= MIN_PARA_BUSCAR || ocultos > 0 || verTodos || buscando) && (
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

      {!buscando && !isLoading && !isError && (ocultos > 0 || verTodos) && (
        <div className="mx-5 mb-2 flex items-center justify-between gap-2 text-xs">
          <span className="text-muted-foreground truncate">
            {verTodos ? 'Mostrando todos' : `Con turnos del ${fmtDate(periodo.desde)} al ${fmtDate(periodo.hasta)}`}
          </span>
          <button type="button" onClick={() => setVerTodos(v => !v)} className="font-semibold text-primary-600 hover:underline flex-shrink-0">
            {verTodos ? 'Solo este período' : `Ver todos (${grupos.length})`}
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-5 pb-5">
        {isLoading ? (
          <SkeletonList count={3} />
        ) : isError ? (
          <ErrorState error={error} onRetry={refetch} />
        ) : filtrados.length === 0 ? (
          grupos.length === 0
            ? <EmptyState title="Todavía no hay nada" message="Usa «Crear» para empezar." />
            : buscando
              ? <EmptyState title="Sin resultados" variant="search" />
              : <EmptyState title="Nada en este período" message="Usa «Ver todos» o el buscador para llegar a los demás." />
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
