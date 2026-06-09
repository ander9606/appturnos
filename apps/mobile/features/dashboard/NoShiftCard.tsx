import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export function NoShiftCard() {
  return (
    <View className="mx-4 mt-4 bg-card rounded-2xl p-5 border border-border items-center gap-3">
      <View className="w-14 h-14 rounded-full bg-muted items-center justify-center">
        <Ionicons name="calendar-clear-outline" size={28} color="#94A3B8" />
      </View>
      <Text className="text-base font-semibold text-foreground">Sin turno activo hoy</Text>
      <Text className="text-sm text-muted-foreground text-center">
        No tienes turnos programados para hoy.
      </Text>
    </View>
  );
}
