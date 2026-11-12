import React from 'react';
import type { OfertaDetalle } from '@api-client';
import { ApiError } from '@api-client';
import { showAlert } from '@/lib/alertDialog';
import { showToast } from '@/lib/toast';
import { useOpcionesGrupos } from '@/features/empresas/useOpcionesGrupos';
import { useVincularGrupo } from '@/features/turnos/useTurnos';
import { GrupoBadge } from './GrupoBadge';
import { GrupoSelector } from './GrupoSelector';
import type { GrupoElegido } from '@/features/turnos/crear/types';

/**
 * El grupo en el detalle de un turno. Quien gestiona turnos (con la función encendida) puede elegir, cambiar o
 * quitar el grupo ahí mismo; el resto solo ve la etiqueta. Al cambiar el grupo no se toca el lugar del turno:
 * el lugar del grupo es solo un valor por defecto al crear.
 */
type Oferta = Pick<OfertaDetalle, 'id' | 'grupo_id' | 'grupo_nombre'>;

export function GrupoDeLaOferta({ oferta, puedeGestionar }: { oferta: Oferta; puedeGestionar: boolean }) {
  // Dos componentes para que quien no gestiona no ejecute ningún hook de datos (ni consulte las opciones).
  return puedeGestionar ? <GrupoEditable oferta={oferta} /> : <GrupoBadge nombre={oferta.grupo_nombre} />;
}

function GrupoEditable({ oferta }: { oferta: Oferta }) {
  const { usa, etiqueta } = useOpcionesGrupos();
  const vincular = useVincularGrupo();
  if (!usa) return <GrupoBadge nombre={oferta.grupo_nombre} />;

  const actual: GrupoElegido | null = oferta.grupo_id
    ? { id: oferta.grupo_id, nombre: oferta.grupo_nombre ?? '', lugar: null, latitud: null, longitud: null }
    : null;

  async function cambiar(nuevo: GrupoElegido | null) {
    try {
      await vincular.mutateAsync({ ofertaId: oferta.id, grupoId: nuevo?.id ?? null });
      showToast(nuevo ? `Turno agregado a «${nuevo.nombre}».` : `Turno sin ${etiqueta.toLowerCase()}.`);
    } catch (err) {
      // 409: el grupo está cerrado · 404: ya no existe. El servidor trae el motivo.
      showAlert('No se pudo cambiar', err instanceof ApiError ? err.message : 'Inténtalo de nuevo.');
    }
  }

  return <GrupoSelector grupo={actual} onChange={cambiar} />;
}
