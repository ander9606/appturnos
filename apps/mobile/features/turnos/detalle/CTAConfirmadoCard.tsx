import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Button } from '@/components/ui/Button';
import { GeoFenceIndicator } from '../GeoFenceIndicator';
import { fmtFaltan } from '../turnosUtils';
import type { GeofenceStatus } from '@/lib/geo';

export function CTAConfirmadoCard({
  dentroVentana, minutosParaIngreso, windowMin, isLibre,
  distanceM, geoStatus, canMark, permissionDenied, locationUnavailable,
  ingresando, onIngreso, onIngresoPronto,
}: {
  dentroVentana: boolean;
  minutosParaIngreso: number | null;
  windowMin: number;
  isLibre: boolean;
  distanceM: number | null;
  geoStatus: GeofenceStatus;
  canMark: boolean;
  permissionDenied: boolean;
  locationUnavailable: boolean;
  ingresando: boolean;
  onIngreso: () => void;
  onIngresoPronto: () => void;
}) {
  return (
    <View
      className="bg-card rounded-2xl px-5 py-5 gap-4"
      style={{ elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8 }}
    >
      <Text className="text-sm font-semibold text-foreground">Marcar llegada</Text>

      {/* Countdown — visible mientras falte más de 30 min */}
      {!dentroVentana && minutosParaIngreso !== null && (
        <View className="flex-row items-center gap-2.5 bg-muted rounded-xl px-3 py-3">
          <Ionicons name="time-outline" size={18} color="#64748B" />
          <View className="flex-1">
            <Text className="text-xs text-muted-foreground">El marcaje se habilita en</Text>
            <Text className="text-base font-bold text-foreground tabular-nums">
              {fmtFaltan(minutosParaIngreso - windowMin)}
            </Text>
          </View>
        </View>
      )}

      {!isLibre && (
        <>
          <GeoFenceIndicator
            distanceM={distanceM}
            status={geoStatus}
            permissionDenied={permissionDenied}
            locationUnavailable={locationUnavailable}
          />

          {dentroVentana && !canMark && distanceM !== null && (
            <View className="flex-row items-start gap-2">
              <Ionicons name="information-circle-outline" size={16} color="#64748B" style={{ marginTop: 1 }} />
              <Text className="flex-1 text-xs text-muted-foreground">
                Acércate al punto de trabajo para habilitar el marcaje de entrada.
              </Text>
            </View>
          )}
        </>
      )}

      <Button
        label={ingresando ? 'Registrando ingreso…' : 'Marcar Ingreso'}
        variant="primary"
        size="lg"
        fullWidth
        loading={ingresando}
        disabled={!dentroVentana || !canMark}
        onPress={onIngreso}
        onPressDisabled={!dentroVentana ? onIngresoPronto : undefined}
      />
    </View>
  );
}
