import React from 'react';
import { Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { GrupoTurno } from '@api-client';
import { Text } from '@/components/ui/Text';
import { COLORS } from '@/lib/designTokens';
import { FaseChip } from './FaseGrupo';
import { subtituloGrupo } from './grupoUtils';

/** Tarjeta de un grupo en la lista: nombre, fase, fechas y número de turnos, y el lugar si lo tiene. */
export function GrupoCard({ grupo, onPress }: { grupo: GrupoTurno; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${grupo.nombre}. ${subtituloGrupo(grupo)}`}
      className="bg-card border border-border rounded-2xl p-4 gap-1.5 active:opacity-70"
    >
      <View className="flex-row items-start justify-between gap-2">
        <Text className="flex-1 text-base font-bold text-foreground" numberOfLines={2}>{grupo.nombre}</Text>
        <FaseChip fase={grupo.fase} />
      </View>
      <Text className="text-sm text-muted-foreground">{subtituloGrupo(grupo)}</Text>
      {grupo.lugar ? (
        <View className="flex-row items-center gap-1">
          <Ionicons name="location-outline" size={13} color={COLORS.mutedForeground} />
          <Text className="flex-1 text-xs text-muted-foreground" numberOfLines={1}>{grupo.lugar}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}
