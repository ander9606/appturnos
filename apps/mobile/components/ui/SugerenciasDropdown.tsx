import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { SugerenciaLugar } from '@api-client';

type Props = {
  sugerencias: SugerenciaLugar[];
  searched: boolean;
  onSelect: (s: SugerenciaLugar) => void;
};

/** Dropdown de sugerencias de dirección — compartido entre LugarInput y MapaSelector. */
export function SugerenciasDropdown({ sugerencias, searched, onSelect }: Props) {
  if (sugerencias.length === 0 && !searched) return null;

  return (
    <View
      className="bg-card rounded-2xl overflow-hidden border border-border"
      style={{ elevation: 6, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8 }}
    >
      {sugerencias.length === 0 ? (
        <Text className="px-4 py-3 text-sm text-muted-foreground">Sin resultados</Text>
      ) : (
        sugerencias.map((s, i) => (
          <Pressable
            key={s.place_id}
            className={`px-4 py-3 flex-row items-start gap-2.5 ${
              i < sugerencias.length - 1 ? 'border-b border-border' : ''
            }`}
            onPress={() => onSelect(s)}
          >
            <Ionicons name="location-outline" size={15} color="#64748B" style={{ marginTop: 2 }} />
            <Text className="flex-1 text-sm text-foreground" numberOfLines={2}>
              {s.display_name}
            </Text>
          </Pressable>
        ))
      )}
    </View>
  );
}
