import React from 'react';
import { View } from 'react-native';

export interface CompositionSegment {
  value: number;
  color: string;
}

interface CompositionBarProps {
  segments: CompositionSegment[];
  height?: number;
}

/** Barra apilada horizontal — composición de un total por categoría (ej. tipos de hora). */
export function CompositionBar({ segments, height = 14 }: CompositionBarProps) {
  const visibles = segments.filter((s) => s.value > 0);
  if (visibles.length === 0) return null;

  return (
    <View style={{ flexDirection: 'row', height, borderRadius: height / 2, overflow: 'hidden' }}>
      {visibles.map((s, i) => (
        <View
          key={i}
          style={{
            flex: s.value,
            backgroundColor: s.color,
            marginRight: i < visibles.length - 1 ? 2 : 0,
          }}
        />
      ))}
    </View>
  );
}
