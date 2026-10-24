import React from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { Text } from '@/components/ui/Text';
import { useTheme } from '@/lib/theme';

/**
 * Raíz de una pestaña: la franja de la barra de estado toma el color del perfil (turnos naranja,
 * nómina verde, gestores azul) y sigue con el encabezado, sin corte. docs/DISENO.md §5.10.
 */
export function PantallaPestana({ children }: { children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <SafeAreaView className="flex-1" edges={['top']} style={{ backgroundColor: theme.primary }}>
      <StatusBar style="light" />
      <View className="flex-1 bg-background">{children}</View>
    </SafeAreaView>
  );
}

/** Encabezado de pestaña en el color del perfil: título, subtítulo, acción a la derecha y contenido debajo. */
export function EncabezadoPestana({
  titulo, subtitulo, derecha, children,
}: { titulo: string; subtitulo?: string; derecha?: React.ReactNode; children?: React.ReactNode }) {
  const theme = useTheme();
  return (
    <View className="px-6 pt-3 pb-5 rounded-b-[28px] gap-3" style={{ backgroundColor: theme.primary }}>
      <View className="flex-row items-center justify-between gap-3">
        <View className="flex-1">
          <Text accessibilityRole="header" className="text-white text-xl font-bold" numberOfLines={1}>{titulo}</Text>
          {subtitulo ? <Text className="text-white/75 text-xs mt-0.5">{subtitulo}</Text> : null}
        </View>
        {derecha}
      </View>
      {children}
    </View>
  );
}
