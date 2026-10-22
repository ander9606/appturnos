import React from 'react';
import { View } from 'react-native';
import { Text } from '@/components/ui/Text';
import { COLORS } from '@/lib/designTokens';
import { useConfirmar, useRechazar, useCancelar, useNoPresentado } from '@/features/turnos/useTurnos';
import type { OfertaDetalle } from '@api-client';
import { PostulanteRow } from './PostulanteRow';

/** Postulantes de la oferta (o historial de asistencia si ya pasó), con las acciones del gestor en cada fila. */
export function PostulantesCard({ oferta, esPasado, turnoIniciado, puedeGestionar }: {
  oferta: OfertaDetalle;
  esPasado: boolean;
  turnoIniciado: boolean;
  puedeGestionar: boolean;
}) {
  const confirmarM    = useConfirmar();
  const rechazarM     = useRechazar();
  const cancelarM     = useCancelar();
  const noPresentadoM = useNoPresentado();

  return (
<View className="bg-card rounded-2xl px-5 py-4"
  style={{ elevation: 1, shadowColor: COLORS.shadow, shadowOpacity: 0.04, shadowRadius: 8 }}>
  <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
    {esPasado ? 'Historial de asistencia' : 'Postulantes'}
  </Text>
  {!oferta.asignaciones?.length ? (
    <Text className="text-sm text-muted-foreground py-2">Sin postulantes.</Text>
  ) : (
    oferta.asignaciones.map((a) => (
      <PostulanteRow
        key={a.id}
        asignacion={a}
        ofertaId={oferta.id}
        esPasado={esPasado}
        turnoIniciado={turnoIniciado}
        puedeGestionar={puedeGestionar}
        confirmarM={confirmarM}
        rechazarM={rechazarM}
        cancelarM={cancelarM}
        noPresentadoM={noPresentadoM}
      />
    ))
  )}
</View>
  );
}
