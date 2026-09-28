import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Button } from '@/components/ui/Button';
import { GeoFenceIndicator } from '../GeoFenceIndicator';
import { UbicacionLibreIndicator } from '../UbicacionLibreIndicator';
import { TrabajadorInfoGestor } from './TrabajadorInfoGestor';
import type { EstadoUbicacionLibre } from '../useUbicacionLibre';
import { fmtFaltan } from '../turnosUtils';
import type { GeofenceStatus } from '@/lib/geo';

export function CTAConfirmadoCard({
  dentroVentana, minutosParaIngreso, windowMin, isLibre,
  distanceM, geoStatus, canMark, permissionDenied, locationUnavailable,
  ubicacionLibre, ingresando, onIngreso, onIngresoPronto, isGestor,
  trabajadorTelefono, trabajadorRanking, trabajadorTotalCalificaciones,
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
  ubicacionLibre: { estado: EstadoUbicacionLibre; reintentar: () => void };
  ingresando: boolean;
  onIngreso: () => void;
  onIngresoPronto: () => void;
  isGestor: boolean;
  trabajadorTelefono?: string | null;
  trabajadorRanking?: number | null;
  trabajadorTotalCalificaciones?: number;
}) {
  // El gestor no marca su propia llegada — este CTA es la acción del
  // trabajador (GPS + botón "Marcar Ingreso"). Para el gestor solo tiene
  // sentido el estado informativo: si ya se habilitó el marcaje o cuánto
  // falta. Corregir manualmente el ingreso está en el botón "Corregir
  // horario de entrada/salida" que ya se muestra debajo, en la pantalla.
  if (isGestor) {
    return (
      <View
        className="bg-card rounded-2xl px-5 py-5 gap-2"
        style={{ elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8 }}
      >
        <View className="flex-row items-center gap-2">
          <Ionicons name="hourglass-outline" size={20} color="#64748B" />
          <Text className="text-sm font-semibold text-foreground">Esperando ingreso del trabajador</Text>
        </View>
        <Text className="text-xs text-muted-foreground">
          {dentroVentana
            ? 'El marcaje de entrada ya está habilitado para el trabajador.'
            : minutosParaIngreso !== null
              ? `El marcaje se habilita en ${fmtFaltan(minutosParaIngreso - windowMin)}.`
              : 'El marcaje se habilitará cerca de la hora de entrada.'}
        </Text>

        <TrabajadorInfoGestor
          telefono={trabajadorTelefono}
          ranking={trabajadorRanking}
          totalCalificaciones={trabajadorTotalCalificaciones}
        />
      </View>
    );
  }

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
