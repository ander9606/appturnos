import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { formatCOP } from '@/lib/formatters';
import { LiquidacionTurnoLinea } from './LiquidacionTurnoLinea';
import type { LiquidacionTurnosTrabajador } from '@api-client';

interface Props {
  trabajador:   LiquidacionTurnosTrabajador;
  primaryColor: string;
}

export function LiquidacionTrabajadorCard({ trabajador, primaryColor }: Props) {
  const [expanded, setExpanded] = useState(false);
  const tieneExtra = Number(trabajador.pago_extra) > 0;

  return (
    <View
      className="bg-card rounded-2xl overflow-hidden"
      style={{ elevation: 1, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6 }}
    >
      <TouchableOpacity
        className="px-4 py-4 gap-2"
        onPress={() => setExpanded(v => !v)}
        activeOpacity={0.75}
      >
        {/* Nombre + cargo + ranking + chevron */}
        <View className="flex-row items-start justify-between gap-2">
          <View className="flex-1">
            <Text className="text-sm font-semibold text-foreground">
              {trabajador.nombre} {trabajador.apellido}
            </Text>
            <View className="flex-row items-center gap-2 mt-0.5">
              {trabajador.cargo && (
                <Text className="text-xs text-muted-foreground">{trabajador.cargo}</Text>
              )}
              {trabajador.ranking != null && (
                <View className="flex-row items-center gap-0.5">
                  <Ionicons name="star" size={10} color="#F59E0B" />
                  <Text className="text-[10px] font-semibold text-amber-600">
                    {Number(trabajador.ranking).toFixed(1)}
                  </Text>
                  <Text className="text-[10px] text-muted-foreground">
                    ({trabajador.total_calificaciones})
                  </Text>
                </View>
              )}
            </View>
          </View>
          <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color="#94A3B8" />
        </View>

        {/* Totales */}
        <View className="flex-row gap-3">
          <View className="gap-0.5">
            <Text className="text-sm font-bold text-foreground">{trabajador.total_turnos}</Text>
            <Text className="text-[10px] text-muted-foreground">Turnos</Text>
          </View>
          <View className="gap-0.5">
            <Text className="text-sm font-bold text-foreground">
              {Number(trabajador.total_horas).toFixed(1)}h
            </Text>
            <Text className="text-[10px] text-muted-foreground">Horas</Text>
          </View>
          <View className="flex-1 gap-0.5 items-end">
            <Text className="text-sm font-bold" style={{ color: primaryColor }}>
              {formatCOP(Number(trabajador.pago_total))}
            </Text>
            {tieneExtra ? (
              <Text className="text-[10px] text-amber-600 font-medium">
                +{formatCOP(Number(trabajador.pago_extra))} extra
              </Text>
            ) : (
              <Text className="text-[10px] text-muted-foreground">sin horas extra</Text>
            )}
          </View>
        </View>
      </TouchableOpacity>

      {/* Desglose de turnos */}
      {expanded && (
        <View className="px-4 pb-3 border-t border-border">
          {trabajador.turnos.map((t) => (
            <LiquidacionTurnoLinea
              key={t.asignacion_id}
              linea={t}
              primaryColor={primaryColor}
            />
          ))}
        </View>
      )}
    </View>
  );
}
