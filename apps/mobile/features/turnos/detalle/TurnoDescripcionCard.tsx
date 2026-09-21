import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export function TurnoDescripcionCard({
  descripcion, notasExterno,
}: {
  descripcion: string | null | undefined;
  notasExterno: string | null | undefined;
}) {
  if (!descripcion && !notasExterno) return null;

  return (
    <View
      className="bg-card rounded-2xl px-5 py-4 gap-3"
      style={{ elevation: 1, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8 }}
    >
      {descripcion && (
        <View className="gap-1">
          <View className="flex-row items-center gap-2">
            <Ionicons name="cube-outline" size={14} color="#64748B" />
            <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Material a instalar
            </Text>
          </View>
          <Text className="text-sm text-foreground leading-5 pl-5">{descripcion}</Text>
        </View>
      )}
      {descripcion && notasExterno && (
        <View className="border-t border-border" />
      )}
      {notasExterno && (
        <View className="gap-1">
          <View className="flex-row items-center gap-2">
            <Ionicons name="people-outline" size={14} color="#64748B" />
            <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Equipo del cliente
            </Text>
          </View>
          <Text className="text-sm text-foreground leading-5 pl-5">{notasExterno}</Text>
        </View>
      )}
    </View>
  );
}
