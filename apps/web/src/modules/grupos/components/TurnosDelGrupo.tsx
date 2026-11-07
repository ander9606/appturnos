import { Link } from 'react-router';
import { Plus } from 'lucide-react';
import { Skeleton } from '@/shared/components/Skeleton';
import { useGrupo } from '../hooks/useGrupos';
import { FilaTurno } from './FilaTurno';
import type { EstadoGrupo } from '../types';

/**
 * Lo que se despliega dentro de la tarjeta de un grupo: sus turnos por fecha (clic en uno abre el turno) y, si el
 * grupo sigue activo, «Agregar turno»; y «Abrir grupo» para duplicar o cerrar. Los turnos se piden al desplegar (no con
 * la lista) y comparten caché con el detalle del grupo.
 */
export function TurnosDelGrupo({ grupoId, estado }: { grupoId: number; estado: EstadoGrupo }) {
  const { data, isLoading, isError, refetch } = useGrupo(grupoId);

  if (isLoading) {
    return (
      <div className="px-4 py-3 border-t border-border flex flex-col gap-2" role="status" aria-label="Cargando turnos">
        <Skeleton className="h-3.5 w-24" /><Skeleton className="h-4 w-2/3" /><Skeleton className="h-3 w-1/2" />
      </div>
    );
  }
  if (isError || !data) {
    return (
      <div className="px-4 py-3 border-t border-border flex items-center justify-between gap-3" role="alert">
        <p className="text-sm text-danger">No se pudieron cargar los turnos.</p>
        <button type="button" onClick={() => refetch()} className="text-sm font-medium text-primary-600 hover:underline">Reintentar</button>
      </div>
    );
  }
  const turnos = data.data.turnos;

  return (
    <div>
      {turnos.length === 0
        ? <p className="px-4 py-3 border-t border-border text-sm text-muted-foreground">Todavía no hay turnos en este grupo.</p>
        : turnos.map(t => <FilaTurno key={t.id} turno={t} compacta />)}
      <div className="flex flex-wrap gap-2 px-4 py-3 border-t border-border">
        {estado === 'activo' && (
          <Link to={`/turnos?grupo=${grupoId}`} className="flex items-center gap-1.5 border border-primary/30 bg-primary-50 text-primary-600 hover:bg-primary-100 text-sm font-medium px-3 py-1.5 rounded-lg transition-colors">
            <Plus size={14} aria-hidden="true" /> Agregar turno
          </Link>
        )}
        <Link to={`/grupos/${grupoId}`} className="text-sm font-medium text-muted-foreground hover:text-foreground border border-border hover:bg-muted px-3 py-1.5 rounded-lg transition-colors">
          Abrir grupo
        </Link>
      </div>
    </div>
  );
}
