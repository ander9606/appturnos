import React from 'react';
import { View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function TurnosScreen() {
  return (
    <SafeAreaView className="flex-1 bg-background items-center justify-center" edges={['top']}>
      <Text className="text-4xl mb-3">📅</Text>
      <Text className="text-xl font-bold text-foreground">Mis Turnos</Text>
      <Text className="text-sm text-muted-foreground mt-1">Próximamente</Text>
    </SafeAreaView>
  );
}
