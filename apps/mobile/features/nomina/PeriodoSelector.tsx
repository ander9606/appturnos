import { Text } from '@/components/ui/Text';
import React from 'react';
import { View, TouchableOpacity, ScrollView } from 'react-native';
import type { PeriodoNomina } from '@api-client';
import { fmtPeriodo, abarcanVariosAnios } from './trabajador/nominaTrabajadorUtils';
import { COLORS } from '@/lib/designTokens';

interface PeriodoSelectorProps {
  /** Ordenados fecha_inicio DESC — periodos[0] es el más reciente. */
  periodos: PeriodoNomina[];
  activeId: number | undefined;
  onSelect: (id: number) => void;
  max?: number;
  /** 'onColor' = fondo de color (header); 'onCard' = fondo plano de la pantalla. */
  variant?: 'onColor' | 'onCard';
}

/**
 * Selector horizontal de períodos, compartido por las 3 vistas de Nómina que
 * navegan históricos (gestores, jefe_turnos, trabajador_turnos) para que el
 * mismo concepto se vea y se use igual en toda la app.
 *
 * Solo muestra períodos del mismo `tipo` que el más reciente — si la empresa
 * cambió de ciclo de facturación (mensual → quincenal), no mezcla ambos
 * esquemas en la misma lista.
 */
export function PeriodoSelector({ periodos, activeId, onSelect, max = 8, variant = 'onCard' }: PeriodoSelectorProps) {
  const tipoActual = periodos[0]?.tipo;
  const filtrados = periodos.filter((p) => p.tipo === tipoActual);
  if (filtrados.length === 0) return null;

  const onColor = variant === 'onColor';
  const visibles = filtrados.slice(0, max);
  // "16–30 Nov" es ambiguo cuando la lista cruza de año: ahí se muestra el año.
  const conAnio = abarcanVariosAnios(visibles);

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View className="flex-row gap-2 py-1">
        {visibles.map((p) => {
          const active = p.id === activeId;
          return (
            <TouchableOpacity
              key={p.id}
              onPress={() => onSelect(p.id)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`${fmtPeriodo(p, true)}, ${p.estado}`}
              hitSlop={6}
              className={[
                'flex-row items-center gap-1.5',
                onColor ? 'px-3 py-1.5' : 'px-4 py-2',
                'rounded-full border',
                onColor
                  ? (active ? 'bg-white/25 border-white/30' : 'border-white/30')
                  : (active ? 'bg-foreground border-foreground' : 'bg-card border-border'),
              ].join(' ')}
            >
              {/* El estado del período, además del color: abierto (verde), cerrado (ámbar), liquidado (gris). */}
              <View
                style={{
                  width: 6, height: 6, borderRadius: 3,
                  backgroundColor: p.estado === 'abierto' ? COLORS.success : p.estado === 'cerrado' ? COLORS.warning : COLORS.placeholder,
                }}
              />
              <Text
                className={[
                  'text-xs font-medium',
                  onColor ? 'text-white' : (active ? 'text-white' : 'text-foreground'),
                ].join(' ')}
              >
                {fmtPeriodo(p, conAnio)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </ScrollView>
  );
}
