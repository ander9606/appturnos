import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { NovedadCard } from '@/features/novedades/NovedadCard';
import type { Novedad } from '@api-client';

export function NovedadesCard({
  novedades, onReportar,
}: {
  novedades: Novedad[];
  onReportar: () => void;
}) {
  return (
    <View
      className="bg-card rounded-2xl px-5 py-4"
      style={{ elevation: 1, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8 }}
    >
      <View className="flex-row items-center justify-between mb-3">
        <Text className="text-sm font-semibold text-foreground">Novedades</Text>
        <TouchableOpacity
          onPress={onReportar}
          className="flex-row items-center gap-1.5 px-3 py-1.5 bg-muted rounded-xl"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="add" size={16} color="#0284C7" />
          <Text className="text-xs font-semibold text-info">Reportar</Text>
        </TouchableOpacity>
      </View>
      {novedades.length === 0 ? (
        <Text className="text-sm text-muted-foreground">Sin novedades reportadas.</Text>
      ) : (
        novedades.map((n) => <NovedadCard key={n.id} novedad={n} />)
      )}
    </View>
  );
}
