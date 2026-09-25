import React from 'react';
import { View, Text } from 'react-native';

import { UbicacionLink } from '@/components/ui/UbicacionLink';
import type { Asignacion } from '@api-client';

/** Ubicación marcada — sobre todo relevante en turnos con geofence 'libre'
 *  (ej. camioneros): no se valida contra un punto fijo, pero igual se
 *  guarda dónde se marcó cada extremo. */
export function TurnoUbicacionMarcada({ asignacion }: { asignacion: Asignacion }) {
  if (asignacion.latitud_ingreso == null && asignacion.latitud_egreso == null) return null;

  return (
    <View
      className="bg-card rounded-2xl px-5 py-4 gap-2"
      style={{ elevation: 1, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8 }}
    >
      <Text className="text-xs text-muted-foreground uppercase tracking-wide font-semibold mb-1">
        Ubicación marcada
      </Text>
      {asignacion.latitud_ingreso != null && (
        <UbicacionLink lat={asignacion.latitud_ingreso} lng={asignacion.longitud_ingreso!} label="Entrada" />
      )}
      {asignacion.latitud_egreso != null && (
        <UbicacionLink lat={asignacion.latitud_egreso} lng={asignacion.longitud_egreso!} label="Salida" />
      )}
    </View>
  );
}
