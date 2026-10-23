import React from 'react';
import { View, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Text } from '@/components/ui/Text';
import { COLORS } from '@/lib/designTokens';
import { useTheme } from '@/lib/theme';
import { etiquetaDia } from '@/lib/calendar';

export interface ItemDia {
  key: string;
  titulo: string;
  /** Segunda línea: horario, plazas, estado… */
  detalle?: string;
  /** Color del punto (el mismo que lleva ese turno en el calendario). */
  color: string;
  onPress: () => void;
}

/** Vista previa del día marcado en el calendario del mes, con paso a la lista completa. */
export function ResumenDiaMes({
  fecha, items, onVerLista,
}: { fecha: string; items: ItemDia[]; onVerLista: () => void }) {
  const theme = useTheme();
  return (
    <View className="bg-card border border-border rounded-3xl mt-4 px-4 py-3">
      <View className="flex-row items-center justify-between mb-1">
        <Text accessibilityRole="header" className="text-sm font-bold text-foreground">{etiquetaDia(fecha)}</Text>
        <TouchableOpacity onPress={onVerLista} accessibilityRole="button" hitSlop={8} className="flex-row items-center gap-0.5">
          <Text className="text-xs font-semibold" style={{ color: theme.primary }}>Ver en lista</Text>
          <Ionicons name="chevron-forward" size={14} color={theme.primary} />
        </TouchableOpacity>
      </View>
      {items.length === 0 ? (
        <Text className="text-sm text-muted-foreground py-2">Sin turnos este día.</Text>
      ) : (
        items.map((it, i) => (
          <TouchableOpacity
            key={it.key}
            onPress={it.onPress}
            activeOpacity={0.7}
            accessibilityRole="button"
            className={`flex-row items-center gap-3 py-2.5 ${i > 0 ? 'border-t border-border/40' : ''}`}
          >
            <View className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: it.color }} />
            <View className="flex-1">
              <Text className="text-sm font-semibold text-foreground" numberOfLines={1}>{it.titulo}</Text>
              {it.detalle ? <Text className="text-xs text-muted-foreground mt-0.5" numberOfLines={1}>{it.detalle}</Text> : null}
            </View>
            <Ionicons name="chevron-forward" size={16} color={COLORS.placeholder} />
          </TouchableOpacity>
        ))
      )}
    </View>
  );
}
