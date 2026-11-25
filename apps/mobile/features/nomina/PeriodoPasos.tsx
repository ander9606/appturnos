/**
 * PeriodoPasos — dónde está el período en su ciclo: Abierto → Cerrado → Liquidado. Reemplaza la frase que explicaba
 * cada estado ("Horas congeladas — pendiente de pago…"): el paso actual se ve de un vistazo y los anteriores quedan
 * marcados como hechos.
 */
import { Text } from '@/components/ui/Text';
import React from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { EstadoPeriodo } from '@api-client';
import { COLORS } from '@/lib/designTokens';

const PASOS: { estado: EstadoPeriodo; label: string; icono: React.ComponentProps<typeof Ionicons>['name'] }[] = [
  { estado: 'abierto',   label: 'Abierto',   icono: 'lock-open-outline' },
  { estado: 'cerrado',   label: 'Cerrado',   icono: 'lock-closed-outline' },
  { estado: 'liquidado', label: 'Liquidado', icono: 'checkmark-circle-outline' },
];

export function PeriodoPasos({ estado }: { estado: EstadoPeriodo }) {
  const actual = Math.max(0, PASOS.findIndex((p) => p.estado === estado));

  return (
    <View
      className="flex-row items-start px-1"
      accessible
      accessibilityLabel={`Período ${PASOS[actual].label.toLowerCase()}, paso ${actual + 1} de ${PASOS.length}`}
    >
      {PASOS.map((p, i) => {
        const alcanzado = i <= actual;
        return (
          <React.Fragment key={p.estado}>
            {i > 0 && <View className={`flex-1 h-0.5 mt-[13px] ${i <= actual ? 'bg-success' : 'bg-border'}`} />}
            <View className="items-center gap-1" style={{ width: 64 }}>
              <View className={`w-7 h-7 rounded-full items-center justify-center ${alcanzado ? 'bg-success' : 'bg-muted'}`}>
                <Ionicons name={i < actual ? 'checkmark' : p.icono} size={15} color={alcanzado ? COLORS.white : COLORS.mutedForeground} />
              </View>
              <Text className={`text-[11px] ${i === actual ? 'font-bold text-foreground' : 'text-muted-foreground'}`}>{p.label}</Text>
            </View>
          </React.Fragment>
        );
      })}
    </View>
  );
}
