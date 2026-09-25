import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Button } from '@/components/ui/Button';
import { GeoFenceIndicator } from '../GeoFenceIndicator';
import { UbicacionLibreIndicator } from '../UbicacionLibreIndicator';
import type { EstadoUbicacionLibre } from '../useUbicacionLibre';
import { fmtTime } from '../turnosUtils';
import type { GeofenceStatus } from '@/lib/geo';

export function CTAEnProgresoCard({
  elapsedLabel, horaIngresoReal, isLibre,
  distanceM, geoStatus, canMark, permissionDenied, locationUnavailable,
  ubicacionLibre, onMarcarSalida, isGestor, onCorregir,
}: {
  elapsedLabel: string | null;
  horaIngresoReal: string | null;
  isLibre: boolean;
  distanceM: number | null;
  geoStatus: GeofenceStatus;
  canMark: boolean;
  permissionDenied: boolean;
  locationUnavailable: boolean;
  ubicacionLibre: { estado: EstadoUbicacionLibre; reintentar: () => void };
  onMarcarSalida: () => void;
  isGestor: boolean;
  onCorregir: () => void;
}) {
  return (
    <View
      className="bg-card rounded-2xl px-5 py-5 gap-4"
      style={{ elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8 }}
    >
      <Text className="text-sm font-semibold text-foreground">Turno en curso</Text>

      {/* Live elapsed time */}
      <View className="bg-success-light rounded-2xl px-4 py-4 items-center gap-1">
        <View className="flex-row items-center gap-2 mb-1">
          <View className="w-2 h-2 rounded-full bg-success" />
          <Text className="text-xs font-medium text-success uppercase tracking-wide">
            Tiempo transcurrido
          </Text>
        </View>
        <Text className="text-3xl font-bold text-success tabular-nums">
          {elapsedLabel ?? '—'}
        </Text>
        {horaIngresoReal && (
          <Text className="text-xs text-success/70 mt-1">
            Ingreso registrado a las {fmtTime(horaIngresoReal.slice(11, 19))}
          </Text>
        )}
      </View>

      {isLibre ? (
        <UbicacionLibreIndicator estado={ubicacionLibre.estado} onReintentar={ubicacionLibre.reintentar} />
      ) : (
        <>
          <GeoFenceIndicator
            distanceM={distanceM}
            status={geoStatus}
            permissionDenied={permissionDenied}
            locationUnavailable={locationUnavailable}
          />

          {!canMark && distanceM !== null && (
            <View className="flex-row items-start gap-2">
              <Ionicons name="information-circle-outline" size={16} color="#64748B" style={{ marginTop: 1 }} />
              <Text className="flex-1 text-xs text-muted-foreground">
                Acércate al punto de trabajo para habilitar el marcaje de salida.
              </Text>
            </View>
          )}
        </>
      )}

      <Button
        label="Marcar Salida"
        variant="primary"
        size="lg"
        fullWidth
        disabled={!canMark}
        onPress={onMarcarSalida}
      />
      <Text className="text-xs text-center text-muted-foreground">
        Se requiere firma digital para confirmar la salida.
      </Text>

      {isGestor && (
        <TouchableOpacity
          onPress={onCorregir}
          className="flex-row items-center justify-center gap-1.5 py-2"
        >
          <Ionicons name="time-outline" size={14} color="#64748B" />
          <Text className="text-xs font-semibold text-muted-foreground">Corregir ingreso/egreso</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
