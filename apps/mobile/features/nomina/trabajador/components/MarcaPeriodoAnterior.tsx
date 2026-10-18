import React from 'react';
import { View } from 'react-native';

/**
 * Raya vertical sobre la barra de horas semanales: a su izquierda están las horas que cayeron en el
 * período anterior. No se pinta si no hay (horas <= 0). Va dentro de la barra (`relative`).
 */
export function MarcaPeriodoAnterior({ horas, limite, color }: { horas: number; limite: number; color: string }) {
  if (horas <= 0 || limite <= 0) return null;
  const pct = Math.min(100, (horas / limite) * 100);
  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      style={{ position: 'absolute', top: 0, bottom: 0, left: `${pct}%`, width: 2, marginLeft: -1, backgroundColor: color }}
    />
  );
}
