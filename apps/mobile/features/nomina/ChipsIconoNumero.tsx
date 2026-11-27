/**
 * ChipsIconoNumero — "qué mirar" en un vistazo: ícono + número en vez de frases (DISENO §5.12).
 * Compartido por la fila del gestor (LiquidacionRow) y los registros del equipo (registros-periodo).
 */
import React from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/Text';

export interface ChipIconoNumero {
  /** Cantidad: con 0 el chip no se pinta. */
  cantidad: number;
  /** Lo que se ve junto al ícono (por defecto la cantidad). */
  texto?: string;
  icono: React.ComponentProps<typeof Ionicons>['name'];
  color: string;
  /** Frase completa para lector de pantalla — el chip no lleva texto. */
  etiqueta: string;
}

export function ChipsIconoNumero({ items, fondo = 'bg-muted' }: { items: ChipIconoNumero[]; fondo?: string }) {
  const visibles = items.filter((i) => i.cantidad > 0);
  if (visibles.length === 0) return null;
  return (
    <View className="flex-row flex-wrap gap-1.5 mt-1">
      {visibles.map((i) => (
        <View
          key={i.etiqueta}
          accessible
          accessibilityLabel={i.etiqueta}
          className={`flex-row items-center gap-0.5 ${fondo} rounded-full px-1.5 py-0.5`}
        >
          <Ionicons name={i.icono} size={12} color={i.color} />
          <Text className="text-[11px] font-bold text-foreground">{i.texto ?? i.cantidad}</Text>
        </View>
      ))}
    </View>
  );
}
