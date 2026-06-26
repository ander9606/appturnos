/**
 * LiquidacionRow — fila de trabajador en la vista de liquidación (jefe/admin)
 */
import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { LiquidacionLinea, DescansoCompensatorio } from '@api-client';
import { getInitials } from '@/lib/formatters';
import { avatarColorForId } from '@/lib/designTokens';

interface LiquidacionRowProps {
  linea: LiquidacionLinea;
  compensatorios?: DescansoCompensatorio[];
  periodoId?: number;
}

export function LiquidacionRow({ linea, compensatorios = [], periodoId }: LiquidacionRowProps) {
  const [expanded, setExpanded] = useState(false);
  const router = useRouter();

  const totalHoras =
    linea.horas_ordinarias + linea.horas_extra_diurnas +
    linea.horas_extra_nocturnas + linea.horas_nocturnas + linea.horas_festivo;

  const extrasTotal = linea.horas_extra_diurnas + linea.horas_extra_nocturnas;

  return (
    <TouchableOpacity
      onPress={() => setExpanded((v) => !v)}
      activeOpacity={0.8}
      className="bg-card rounded-2xl overflow-hidden"
      style={{ elevation: 1, shadowColor:'#000', shadowOpacity:0.05, shadowRadius:6 }}
    >
      {/* ── Main row ─────────────────────────────────────────── */}
      <View className="flex-row items-center px-4 py-4 gap-3">
        {/* Avatar */}
        <View
          className="w-10 h-10 rounded-full items-center justify-center"
          style={{ backgroundColor: avatarColorForId(linea.trabajador_id) }}
        >
          <Text className="text-sm font-bold text-white">
            {getInitials(linea.nombre, linea.apellido)}
          </Text>
        </View>

        {/* Name + days + badges */}
        <View className="flex-1 gap-0.5">
          <Text className="text-sm font-semibold text-foreground">
            {linea.nombre} {linea.apellido}
          </Text>
          <Text className="text-xs text-muted-foreground">
            {linea.dias_registrados} días · {totalHoras.toFixed(1)}h totales
          </Text>
          {(extrasTotal > 0 || compensatorios.length > 0) && (
            <View className="flex-row gap-1.5 mt-0.5">
              {extrasTotal > 0 && (
                <View className="bg-primary/10 px-2 py-0.5 rounded-full">
                  <Text className="text-[10px] font-semibold text-primary">
                    ⚡ {extrasTotal.toFixed(1)}h extras
                  </Text>
                </View>
              )}
              {compensatorios.length > 0 && (
                <View className="bg-purple-100 px-2 py-0.5 rounded-full">
                  <Text className="text-[10px] font-semibold text-purple-600">
                    {compensatorios.length} comp.
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>

        {/* Total pay + expand toggle */}
        <View className="items-end gap-1">
          <Text className="text-base font-bold text-success">
            ${linea.total.toLocaleString('es-CO')}
          </Text>
          <Text className="text-xs text-muted-foreground">{expanded ? '▲' : '▼'}</Text>
        </View>
      </View>

      {/* ── Expanded: hour breakdown + link ──────────────────── */}
      {expanded && (
        <View className="px-4 pb-4 border-t border-border">
          <View className="flex-row flex-wrap gap-x-4 gap-y-2 mt-3">
            {[
              { l: 'Ordinarias',   v: linea.horas_ordinarias,      c: 'text-foreground' },
              { l: 'Extra diurna', v: linea.horas_extra_diurnas,   c: 'text-primary-500' },
              { l: 'Extra noct.',  v: linea.horas_extra_nocturnas, c: 'text-primary-600' },
              { l: 'Nocturnas',    v: linea.horas_nocturnas,       c: 'text-info' },
              { l: 'Festivo',      v: linea.horas_festivo,         c: 'text-danger' },
            ].filter(item => item.v > 0).map((item) => (
              <View key={item.l} className="gap-0.5 min-w-[80px]">
                <Text className="text-[10px] text-muted-foreground">{item.l}</Text>
                <Text className={`text-sm font-semibold ${item.c}`}>
                  {item.v.toFixed(1)}h
                </Text>
              </View>
            ))}
            <View className="gap-0.5 min-w-[80px]">
              <Text className="text-[10px] text-muted-foreground">Valor/hora</Text>
              <Text className="text-sm font-semibold text-muted-foreground">
                ${linea.valor_hora.toLocaleString('es-CO')}
              </Text>
            </View>
          </View>
          {periodoId && (
            <TouchableOpacity
              onPress={() => router.push(
                `/registros-periodo?periodoId=${periodoId}&trabajadorId=${linea.trabajador_id}`
              )}
              className="flex-row items-center gap-1 mt-3"
            >
              <Ionicons name="calendar-outline" size={13} color="#6366F1" />
              <Text className="text-xs font-semibold text-primary">Ver registros del período</Text>
              <Ionicons name="chevron-forward" size={12} color="#6366F1" />
            </TouchableOpacity>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
}
