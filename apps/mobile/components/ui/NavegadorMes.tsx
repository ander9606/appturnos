import React from 'react';
import { View, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Text } from '@/components/ui/Text';
import { alpha } from '@/lib/designTokens';
import { useTheme } from '@/lib/theme';
import { MESES_LARGOS } from '@/lib/calendar';

/** Selector de mes (‹ Octubre 2026 ›) en el color del perfil; el mismo en Turnos y Nómina. */
export function NavegadorMes({
  mes, anio, onAnterior, onSiguiente, onHoy,
}: {
  mes: number; anio: number; onAnterior: () => void; onSiguiente: () => void;
  /** Si se pasa, aparece el botón "Hoy" (el caller lo omite cuando ya se ve el mes actual). */
  onHoy?: () => void;
}) {
  const theme = useTheme();
  const boton = { backgroundColor: alpha(theme.primary, 0.1) };
  return (
    <View className="flex-row items-center gap-3">
      <TouchableOpacity
        onPress={onAnterior}
        accessibilityRole="button"
        accessibilityLabel="Mes anterior"
        className="w-9 h-9 items-center justify-center rounded-xl"
        style={boton}
      >
        <Ionicons name="chevron-back" size={18} color={theme.primary} />
      </TouchableOpacity>
      <View className="flex-1 flex-row items-center justify-center gap-2">
        <Text accessibilityRole="header" className="text-base font-bold text-foreground text-center">
          {MESES_LARGOS[mes - 1]} {anio}
        </Text>
        {onHoy && (
          <TouchableOpacity
            onPress={onHoy}
            accessibilityRole="button"
            accessibilityLabel="Ir al mes actual"
            className="rounded-full px-2.5 py-1"
            style={boton}
          >
            <Text className="text-xs font-bold" style={{ color: theme.primary }}>Hoy</Text>
          </TouchableOpacity>
        )}
      </View>
      <TouchableOpacity
        onPress={onSiguiente}
        accessibilityRole="button"
        accessibilityLabel="Mes siguiente"
        className="w-9 h-9 items-center justify-center rounded-xl"
        style={boton}
      >
        <Ionicons name="chevron-forward" size={18} color={theme.primary} />
      </TouchableOpacity>
    </View>
  );
}
