import { toast } from 'sonner';
import { useVincularGrupo } from '@/modules/turnos/hooks/useTurnos';
import { useOpcionesGrupos } from '@/modules/configuracion/hooks/useConfiguracion';
import { GrupoBadge } from './GrupoBadge';
import { GrupoSelector } from './GrupoSelector';
import type { GrupoElegido } from '../types';

interface Props {
  oferta: { id: number; grupo_id?: number | null; grupo_nombre?: string | null };
  puedeGestionar: boolean;
}

/**
 * El grupo en el detalle de un turno. Quien gestiona turnos, con los grupos activados en su empresa, puede
 * elegir, cambiar o quitar el grupo ahí mismo; el resto (o si la empresa no los usa) solo ve la etiqueta.
 * Cambiar el grupo no toca el lugar del turno.
 */
export function GrupoDeLaOferta({ oferta, puedeGestionar }: Props) {
  // Dos componentes para que quien no gestiona no ejecute ningún hook de datos.
  return puedeGestionar ? <GrupoEditable oferta={oferta} /> : <GrupoBadge nombre={oferta.grupo_nombre} />;
}

function GrupoEditable({ oferta }: Pick<Props, 'oferta'>) {
  const { usa } = useOpcionesGrupos();
  const vincular = useVincularGrupo();
  if (!usa) return <GrupoBadge nombre={oferta.grupo_nombre} />;

  const actual: GrupoElegido | null = oferta.grupo_id
    ? { id: oferta.grupo_id, nombre: oferta.grupo_nombre ?? '', lugar: null, latitud: null, longitud: null }
    : null;

  const cambiar = (nuevo: GrupoElegido | null) =>
    vincular.mutate(
      { ofertaId: oferta.id, grupoId: nuevo?.id ?? null },
      { onSuccess: () => toast.success(nuevo ? `Turno agregado a «${nuevo.nombre}»` : 'Turno quitado del grupo') },
    );

  return <GrupoSelector grupo={actual} onChange={cambiar} />;
}
