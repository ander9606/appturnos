/**
 * TrabajadorInfoGestor — desempeño previo + acceso rápido para llamar al
 * trabajador, mostrado al gestor en el detalle de turno (confirmado / en
 * curso) en vez del CTA de marcaje que no le corresponde.
 */
import React from 'react';
import { View, Text, TouchableOpacity, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { StarRating } from '../StarRating';
import { nivelRanking, rankingLabel, rankingColor, rankingDescription } from '../rankingUtils';

export function TrabajadorInfoGestor({
  telefono, ranking, totalCalificaciones,
}: {
  telefono: string | null | undefined;
  ranking: number | null | undefined;
  totalCalificaciones: number | undefined;
}) {
  const tieneRanking = ranking != null && (totalCalificaciones ?? 0) > 0;
  const nivel = nivelRanking(ranking, totalCalificaciones);
  const color = rankingColor(nivel);

  if (!telefono && !tieneRanking) return null;

  return (
    <View className="bg-muted rounded-xl px-4 py-3 gap-3">
      <View className="gap-1">
        <Text className="text-xs text-muted-foreground">Desempeño previo</Text>
        {tieneRanking ? (
          <>
            <View className="flex-row items-center gap-2">
              <StarRating mode="display" value={Number(ranking)} size="sm" />
              <View className="rounded-full px-2 py-0.5" style={{ backgroundColor: `${color}20` }}>
                <Text className="text-xs font-semibold" style={{ color }}>{rankingLabel(nivel)}</Text>
              </View>
            </View>
            <Text className="text-xs text-muted-foreground" numberOfLines={1}>
              {totalCalificaciones} {totalCalificaciones === 1 ? 'calificación' : 'calificaciones'} · {rankingDescription(nivel)}
            </Text>
          </>
        ) : (
          <Text className="text-sm text-foreground">Sin calificaciones aún</Text>
        )}
      </View>

      {telefono && (
        <TouchableOpacity
          onPress={() => Linking.openURL(`tel:${telefono}`)}
          className="flex-row items-center justify-center gap-1.5 bg-card rounded-lg py-2.5"
          accessibilityLabel="Llamar al trabajador"
          hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
        >
          <Ionicons name="call-outline" size={16} color="#3B82F6" />
          <Text className="text-sm font-semibold text-info">Llamar al trabajador</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
