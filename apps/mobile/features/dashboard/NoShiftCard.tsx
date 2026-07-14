import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

export function NoShiftCard() {
  const router = useRouter();
  return (
    <View className="mx-4 mt-4 bg-card rounded-2xl p-5 border border-border items-center gap-3">
      <View className="w-14 h-14 rounded-full bg-muted items-center justify-center">
        <Ionicons name="calendar-clear-outline" size={28} color="#94A3B8" />
      </View>
      <Text className="text-base font-semibold text-foreground">Sin turno activo hoy</Text>
      <Text className="text-sm text-muted-foreground text-center">
        No tienes turnos programados para hoy.
      </Text>
      <Pressable
        onPress={() => router.push('/(tabs)/turnos')}
        className="flex-row items-center gap-1.5 mt-1 active:opacity-70"
      >
        <Text className="text-sm font-semibold text-primary">Ver turnos disponibles</Text>
        <Ionicons name="arrow-forward" size={14} color="#FF5A3C" />
      </Pressable>
    </View>
  );
}
