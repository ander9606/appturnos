import React from 'react';
import { TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Text } from '@/components/ui/Text';
import { alpha } from '@/lib/designTokens';
import { useTheme } from '@/lib/theme';

/** Única entrada para corregir el horario de un turno (gestores): contorno suave en el color del perfil. */
export function CorregirHorarioButton({ onPress }: { onPress: () => void }) {
  const theme = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel="Corregir horario de entrada y salida"
      className="flex-row items-center justify-center gap-2 rounded-xl py-3 border"
      style={{ backgroundColor: alpha(theme.primary, 0.08), borderColor: alpha(theme.primary, 0.35) }}
    >
      <Ionicons name="time-outline" size={18} color={theme.primary} />
      <Text className="text-base font-semibold" style={{ color: theme.primary }}>Corregir horario</Text>
    </TouchableOpacity>
  );
}
