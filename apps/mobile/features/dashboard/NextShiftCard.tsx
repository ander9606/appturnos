import React from 'react';
import { View, Text, Pressable } from 'react-native';
import type { Asignacion } from '@api-client';
import { fmtTime } from '@/features/turnos/turnosUtils';

interface NextShiftCardProps {
  turno: Asignacion;
  primaryColor: string;
  onPress: () => void;
  onIngreso: () => void;
}

export function NextShiftCard({ turno, primaryColor, onPress, onIngreso }: NextShiftCardProps) {
  return (
    <Pressable
      onPress={onPress}
      className="mx-4 mt-4 bg-card rounded-2xl p-5 border border-border gap-2 active:opacity-80"
    >
      <View className="flex-row items-center justify-between">
        <Text className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
          Próximo turno hoy
        </Text>
        <View className="bg-info/10 rounded-full px-3 py-1">
          <Text className="text-info text-xs font-semibold">Confirmado</Text>
        </View>
      </View>

      <Text className="text-foreground text-lg font-bold" numberOfLines={1}>
        {turno.oferta_titulo}
      </Text>

      <Text className="text-muted-foreground text-sm">
        {fmtTime(turno.hora_inicio)}
        {turno.hora_fin_estimada ? ` – ${fmtTime(turno.hora_fin_estimada)}` : ''}
        {turno.lugar ? `  ·  ${turno.lugar}` : ''}
      </Text>

      <View className="flex-row gap-2 mt-1">
        <Pressable
          onPress={(e) => { e.stopPropagation(); onIngreso(); }}
          className="flex-1 rounded-xl py-2 items-center active:opacity-70"
          style={{ backgroundColor: primaryColor + '1A' }}
        >
          <Text className="text-xs font-semibold" style={{ color: primaryColor }}>
            Marcar Entrada
          </Text>
        </Pressable>
        <Pressable
          onPress={onPress}
          className="flex-1 border border-border rounded-xl py-2 items-center active:opacity-70"
        >
          <Text className="text-muted-foreground text-xs font-semibold">Ver detalle →</Text>
        </Pressable>
      </View>
    </Pressable>
  );
}
