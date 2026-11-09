import React from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/Text';
import { COLORS } from '@/lib/designTokens';
import { COMPENSACION_FALLIDO_MINIMA } from '@api-client';

/**
 * Aviso al trabajador, antes de postularse: qué pasa si el turno se cancela por fuerza mayor y qué
 * pasa si la labor sí se realiza. Misma regla que OfertasService.marcarFallida (docs/REGLAS-CALCULO-PAGOS.md).
 */
export function AvisoFuerzaMayor() {
  const porcentaje = Math.round(COMPENSACION_FALLIDO_MINIMA * 100);
  return (
    <View className="bg-info-light rounded-2xl px-4 py-3 flex-row gap-3" accessibilityRole="summary">
      <Ionicons name="information-circle" size={20} color={COLORS.info} style={{ marginTop: 1 }} />
      <View className="flex-1 gap-1">
        <Text className="text-sm font-semibold text-foreground">Si el turno se cancela por fuerza mayor</Text>
        <Text className="text-sm text-foreground">
          Si por fuerza mayor (corte de luz, emergencia, etc.) el turno se cancela y la tarea no se realiza, recibirás una
          compensación de al menos el {porcentaje} % de la tarifa de tu puesto.
        </Text>
        <Text className="text-sm text-foreground">
          Si la labor sí se realiza, se te paga según tu contrato.
        </Text>
      </View>
    </View>
  );
}
