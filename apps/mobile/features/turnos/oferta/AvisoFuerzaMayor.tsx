import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/Text';
import { COLORS } from '@/lib/designTokens';
import { COMPENSACION_FALLIDO_MINIMA } from '@api-client';

/**
 * Aviso al trabajador, antes de postularse: qué pasa si el turno se cancela por fuerza mayor y qué
 * pasa si la labor sí se realiza. Misma regla que OfertasService.marcarFallida y que la cláusula
 * UNDÉCIMA del contrato (docs/REGLAS-CALCULO-PAGOS.md). Va plegado detrás de un «!» para no ocupar
 * la pantalla; el trabajador lo despliega al tocarlo.
 */
export function AvisoFuerzaMayor() {
  const [abierto, setAbierto] = useState(false);
  const porcentaje = Math.round(COMPENSACION_FALLIDO_MINIMA * 100);
  return (
    <View className="bg-info-light rounded-2xl overflow-hidden">
      <Pressable
        onPress={() => setAbierto((v) => !v)}
        accessibilityRole="button"
        accessibilityLabel="Si el turno se cancela por fuerza mayor"
        accessibilityState={{ expanded: abierto }}
        className="px-4 py-3 flex-row items-center gap-3"
      >
        <View className="w-5 h-5 rounded-full bg-info items-center justify-center">
          <Text className="text-xs font-extrabold text-white">!</Text>
        </View>
        <Text className="flex-1 text-sm font-semibold text-foreground">Si el turno se cancela por fuerza mayor</Text>
        <Ionicons name={abierto ? 'chevron-up' : 'chevron-down'} size={18} color={COLORS.info} />
      </Pressable>
      {abierto && (
        <View className="px-4 pb-3 gap-1.5">
          <Text className="text-sm text-foreground">
            Si por fuerza mayor (corte de luz, emergencia, etc.) el turno se cancela después de que marcaste tu ingreso y
            la tarea no se realiza, recibirás una compensación de al menos el {porcentaje} % de la tarifa de tu puesto.
          </Text>
          <Text className="text-sm text-foreground">
            Si la labor sí se realiza, se te paga según tu contrato.
          </Text>
        </View>
      )}
    </View>
  );
}
