/**
 * ShiftCard — tarjeta de turno/asignación
 *
 * Muestra: barra de color (estado) | título | fecha/hora | lugar | badge estado
 * Tap → onPress (navegar al detalle o expandir)
 */
import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Asignacion } from '@api-client';
import { Badge } from '@/components/ui/Badge';
import { getEstadoConfig, fmtRange, fmtTime } from './turnosUtils';

interface ShiftCardProps {
  asignacion: Asignacion;
  onPress?: () => void;
  showDate?: boolean; // show date label (when listing multiple days)
}

export function ShiftCard({ asignacion, onPress, showDate = false }: ShiftCardProps) {
  const config = getEstadoConfig(asignacion.estado);

  const isActive  = asignacion.estado === 'en_progreso';
  const isToday   = asignacion.oferta_fecha === new Date().toISOString().split('T')[0];

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
      className="bg-card rounded-2xl flex-row overflow-hidden"
      style={{
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
      }}
      accessibilityRole={onPress ? 'button' : 'none'}
      accessibilityLabel={`${asignacion.oferta_titulo}, ${config.label}`}
    >
      {/* ── Accent bar ──────────────────────────────────────────────── */}
      <View
        className="w-1.5"
        style={{ backgroundColor: config.accentColor }}
      />

      {/* ── Content ─────────────────────────────────────────────────── */}
      <View className="flex-1 px-4 py-4 gap-2">
        {/* Top row: title + badge */}
        <View className="flex-row items-start justify-between gap-2">
          <View className="flex-1 gap-0.5">
            <Text className="text-base font-semibold text-foreground" numberOfLines={1}>
              {asignacion.oferta_titulo}
            </Text>
            {showDate && (
              <Text className="text-xs text-muted-foreground">
                {formatShortDate(asignacion.oferta_fecha)}
              </Text>
            )}
          </View>
          <Badge label={config.label} variant={config.badgeVariant} size="sm" />
        </View>

        {/* Meta row: time range + lugar */}
        <View className="flex-row items-center gap-3">
          <View className="flex-row items-center gap-1">
            <Ionicons name="time-outline" size={12} color="#64748B" />
            <Text className="text-sm text-muted-foreground">
              {fmtRange(asignacion.hora_inicio, asignacion.hora_fin_estimada)}
            </Text>
          </View>

          {asignacion.lugar && (
            <View className="flex-row items-center gap-1 flex-1">
              <Ionicons name="location-outline" size={12} color="#64748B" />
              <Text className="text-sm text-muted-foreground" numberOfLines={1}>
                {asignacion.lugar}
              </Text>
            </View>
          )}
        </View>

        {/* In-progress: real ingreso time */}
        {isActive && asignacion.hora_ingreso_real && (
          <View className="flex-row items-center gap-1 bg-success-light rounded-lg px-2 py-1 self-start">
            <View className="w-1.5 h-1.5 rounded-full bg-success" />
            <Text className="text-xs font-medium text-success">
              Ingreso {fmtTime(asignacion.hora_ingreso_real.slice(11, 19))}
            </Text>
          </View>
        )}

        {/* Tarifa */}
        {asignacion.tarifa_dia > 0 && (
          <Text className="text-xs text-muted-foreground">
            ${asignacion.tarifa_dia.toLocaleString('es-CO')} / turno
          </Text>
        )}
      </View>

      {/* ── Chevron ──────────────────────────────────────────────────── */}
      {onPress && (
        <View className="items-center justify-center pr-4">
          <Text className="text-muted-foreground text-lg">›</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

// ── Helper (local, avoids importing lib/formatters circular dep risk) ─────

const SHORT_DAYS   = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const SHORT_MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

function formatShortDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return `${SHORT_DAYS[d.getDay()]} ${d.getDate()} ${SHORT_MONTHS[d.getMonth()]}`;
}
