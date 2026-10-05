import React from 'react';
import { View, Text, Alert } from 'react-native';
import { ApiError } from '@api-client';

import { Button } from '@/components/ui/Button';
import { showToast } from '@/lib/toast';
import { formatCOP } from '@/lib/formatters';
import { useDescuentosAsignacion, useResponderDescuento } from '@/features/turnos/useTurnos';

const ESTADO_LABEL = {
  pendiente: 'Pendiente de tu aceptación',
  aceptado: 'Aceptado',
  rechazado: 'Rechazado',
} as const;

/**
 * Descuentos del turno. El trabajador dueño acepta o rechaza los pendientes;
 * solo los aceptados restan del pago. Sin descuentos no se muestra nada.
 */
export function DescuentosCard({ asignacionId, puedeResponder }: { asignacionId: number; puedeResponder: boolean }) {
  const { data } = useDescuentosAsignacion(asignacionId);
  const descuentos = data?.descuentos ?? [];
  const responder = useResponderDescuento();

  if (descuentos.length === 0) return null;

  async function responderDescuento(id: number, aceptar: boolean) {
    try {
      const resultado = await responder.mutateAsync({ id, aceptar, asignacionId });
      if (resultado.requiere_nueva_firma) {
        showToast('Descuento aceptado. Debes volver a firmar el contrato de este turno.');
      } else {
        showToast(aceptar ? 'Descuento aceptado.' : 'Descuento rechazado.');
      }
    } catch (err) {
      Alert.alert('Error', err instanceof ApiError ? err.message : 'No se pudo responder el descuento.');
    }
  }

  return (
    <View className="bg-card rounded-2xl px-5 py-4 border border-border gap-4">
      <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        Descuentos
      </Text>
      {descuentos.map((d) => (
        <View key={d.id} className="gap-2">
          <View className="flex-row items-center justify-between gap-2">
            <Text className="flex-1 text-sm text-foreground">{d.motivo}</Text>
            <Text className="text-sm font-bold text-danger">−{formatCOP(d.monto)}</Text>
          </View>
          <Text className="text-xs text-muted-foreground">{ESTADO_LABEL[d.estado]}</Text>
          {puedeResponder && d.estado === 'pendiente' && (
            <View className="flex-row gap-2">
              <Button
                label="Rechazar"
                variant="secondary"
                disabled={responder.isPending}
                onPress={() => responderDescuento(d.id, false)}
                style={{ flex: 1 }}
              />
              <Button
                label="Aceptar"
                variant="primary"
                loading={responder.isPending}
                onPress={() => responderDescuento(d.id, true)}
                style={{ flex: 1 }}
              />
            </View>
          )}
        </View>
      ))}
    </View>
  );
}
