import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { formatShortDate, formatTimestampHora, formatCOP } from '@/lib/formatters';
import type { LiquidacionTurnoLinea as TLinea } from '@api-client';

interface Props {
  linea:        TLinea;
  primaryColor: string;
}

export function LiquidacionTurnoLinea({ linea, primaryColor }: Props) {
  const tieneExtra = Number(linea.pago_extra) > 0;

  return (
    <View className="py-2.5 border-b border-border gap-1">
      {/* Título + calificación */}
      <View className="flex-row items-start justify-between gap-2">
        <Text className="text-xs font-medium text-foreground flex-1" numberOfLines={1}>
          {linea.oferta_titulo}
        </Text>
        {linea.calificacion != null ? (
          <View className="flex-row items-center gap-0.5">
            <Ionicons name="star" size={10} color="#F59E0B" />
            <Text className="text-[10px] font-semibold text-amber-600">{linea.calificacion}</Text>
          </View>
        ) : (
          <View className="flex-row items-center gap-0.5">
            <Ionicons name="star-outline" size={10} color="#94A3B8" />
            <Text className="text-[10px] text-muted-foreground">S/C</Text>
          </View>
        )}
      </View>

      {/* Detalles + pago */}
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-2 flex-wrap">
          <View className="flex-row items-center gap-0.5">
            <Ionicons name="calendar-outline" size={10} color="#94A3B8" />
            <Text className="text-[11px] text-muted-foreground">
              {formatShortDate(linea.oferta_fecha)}
            </Text>
          </View>
          <View className="flex-row items-center gap-0.5">
            <Ionicons name="time-outline" size={10} color="#94A3B8" />
            <Text className="text-[11px] text-muted-foreground">
              {formatTimestampHora(linea.hora_ingreso_real)} – {formatTimestampHora(linea.hora_egreso_real)}
            </Text>
          </View>
          <View className="flex-row items-center gap-0.5">
            <Ionicons name="stopwatch-outline" size={10} color="#94A3B8" />
            <Text className="text-[11px] text-muted-foreground">
              {Number(linea.horas_trabajadas).toFixed(1)}h
            </Text>
          </View>
        </View>

        <View className="items-end gap-0.5">
          <Text className="text-xs font-bold" style={{ color: primaryColor }}>
            {formatCOP(Number(linea.pago_total))}
          </Text>
          {tieneExtra && (
            <Text className="text-[10px] text-amber-600 font-medium">
              +{formatCOP(Number(linea.pago_extra))} extra
            </Text>
          )}
        </View>
      </View>
    </View>
  );
}
