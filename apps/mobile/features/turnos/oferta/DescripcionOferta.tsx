import React from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/Text';
import { COLORS } from '@/lib/designTokens';

/** Descripción y detalles adicionales de la oferta (cada uno solo si existe). */
export function DescripcionOferta({ descripcion, notas }: { descripcion: string | null; notas: string | null }) {
  return (
    <>
      {descripcion && (
        <View className="bg-card rounded-2xl px-5 py-4 gap-2"
          style={{ elevation: 1, shadowColor: COLORS.shadow, shadowOpacity: 0.04, shadowRadius: 8 }}>
          <View className="flex-row items-center gap-2">
            <Ionicons name="document-text-outline" size={14} color={COLORS.mutedForeground} />
            <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Descripción
            </Text>
          </View>
          <Text className="text-sm text-foreground leading-5">{descripcion}</Text>
        </View>
      )}

      {notas && (
        <View className="bg-card rounded-2xl px-5 py-4 gap-2"
          style={{ elevation: 1, shadowColor: COLORS.shadow, shadowOpacity: 0.04, shadowRadius: 8 }}>
          <View className="flex-row items-center gap-2">
            <Ionicons name="information-circle-outline" size={14} color={COLORS.mutedForeground} />
            <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Detalles adicionales
            </Text>
          </View>
          <Text className="text-sm text-foreground leading-5">{notas}</Text>
        </View>
      )}
    </>
  );
}
