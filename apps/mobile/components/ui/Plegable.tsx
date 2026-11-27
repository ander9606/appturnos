/**
 * Plegable — tarjeta con cabecera siempre visible y cuerpo que se despliega (DISENO §5.12).
 * Controlado: el padre guarda qué está abierto, así puede ofrecer "Expandir todo".
 * La cabecera lleva el resumen (ícono + número); el chevron y el estado `expanded` dan la affordance y el lector de pantalla.
 */
import React from 'react';
import { View, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/lib/designTokens';

interface Props {
  abierto: boolean;
  onToggle: () => void;
  /** Lo que se ve plegado. */
  cabecera: React.ReactNode;
  /** Objeto del botón para el lector de pantalla: «Desplegar {etiqueta}». */
  etiqueta: string;
  children: React.ReactNode;
}

export function Plegable({ abierto, onToggle, cabecera, etiqueta, children }: Props) {
  return (
    <View className="bg-card border border-border rounded-2xl overflow-hidden">
      <TouchableOpacity
        onPress={onToggle}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityState={{ expanded: abierto }}
        accessibilityLabel={`${abierto ? 'Contraer' : 'Desplegar'} ${etiqueta}`}
        className="px-4 py-3 min-h-[48px] flex-row items-center gap-2"
      >
        <View className="flex-1">{cabecera}</View>
        <Ionicons name={abierto ? 'chevron-up' : 'chevron-down'} size={18} color={COLORS.mutedForeground} />
      </TouchableOpacity>
      {abierto && <View className="border-t border-border">{children}</View>}
    </View>
  );
}
