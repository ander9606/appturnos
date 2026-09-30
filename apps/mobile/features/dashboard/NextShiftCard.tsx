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
  const porReconfirmar = turno.estado === 'por_reconfirmar';

  return (
    <Pressable
      onPress={onPress}
      className="mx-4 mt-4 bg-card rounded-2xl p-5 border border-border gap-2 active:opacity-80"
    >
      <View className="flex-row items-center justify-between">
        <Text className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
          Próximo turno hoy
        </Text>
        <View className={porReconfirmar ? 'bg-warning-light rounded-full px-3 py-1' : 'bg-info/10 rounded-full px-3 py-1'}>
          <Text className={porReconfirmar ? 'text-warning text-xs font-semibold' : 'text-info text-xs font-semibold'}>
            {porReconfirmar ? 'Por reconfirmar' : 'Confirmado'}
          </Text>
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

      {porReconfirmar ? (
        <Text className="text-warning text-xs font-semibold mt-1">
          El horario o lugar cambió — toca para reconfirmar tu participación.
        </Text>
      ) : (
        <View className="flex-row items-center gap-3 mt-1">
          <Pressable
            onPress={(e) => { e.stopPropagation(); onIngreso(); }}
            className="flex-[2] rounded-xl py-3 items-center active:opacity-80"
            style={{ backgroundColor: primaryColor }}
          >
            <Text className="text-sm font-bold text-white">Marcar Entrada</Text>
          </Pressable>
          <Pressable onPress={onPress} className="active:opacity-60">
            <Text className="text-muted-foreground text-xs font-semibold">Ver detalle →</Text>
          </Pressable>
        </View>
      )}
    </Pressable>
  );
}
