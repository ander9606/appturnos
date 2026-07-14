/**
 * GeoFenceIndicator — muestra la proximidad al punto de trabajo
 *
 * Verde  → dentro del radio (≤ 100 m)
 * Ámbar  → cerca (100–200 m)
 * Rojo   → fuera de rango (> 200 m)
 * Gris   → calculando / sin GPS
 */
import React from 'react';
import { View, Text, Linking, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { formatDistance, type GeofenceStatus } from '@/lib/geo';

interface GeoFenceIndicatorProps {
  distanceM: number | null;
  status: GeofenceStatus;
  permissionDenied?: boolean;
  locationUnavailable?: boolean;
}

const STATUS_CONFIG: Record<
  GeofenceStatus | 'loading',
  { bg: string; dot: string; text: string; label: string; hint?: string }
> = {
  inside:  { bg: 'bg-success-light', dot: 'bg-success',         text: 'text-success',         label: 'En el punto de trabajo' },
  near:    { bg: 'bg-warning-light', dot: 'bg-warning',         text: 'text-amber-700',       label: 'Cerca del punto' },
  outside: {
    bg: 'bg-danger-light', dot: 'bg-danger', text: 'text-danger', label: 'Fuera del área de trabajo',
    hint: 'Acércate al punto de marcaje para poder registrar. Si crees que esto es un error, avísale a tu gestor.',
  },
  unknown: { bg: 'bg-muted',         dot: 'bg-muted-foreground', text: 'text-muted-foreground', label: 'Obteniendo ubicación…' },
  loading: { bg: 'bg-muted',         dot: 'bg-muted-foreground', text: 'text-muted-foreground', label: 'Calculando distancia…' },
};

export function GeoFenceIndicator({
  distanceM,
  status,
  permissionDenied = false,
  locationUnavailable = false,
}: GeoFenceIndicatorProps) {
  if (permissionDenied) {
    return (
      <View className="bg-warning-light rounded-2xl px-4 py-3 flex-row items-center gap-3">
        <Ionicons name="warning-outline" size={20} color="#92400E" />
        <View className="flex-1">
          <Text className="text-sm font-semibold text-amber-700">Permiso de ubicación requerido</Text>
          <Text className="text-xs text-amber-600 mt-0.5">
            Actívalo en Ajustes → Ubicación para poder marcar.
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => Linking.openSettings()}
          className="rounded-xl px-3 py-2 bg-amber-700/10"
        >
          <Text className="text-xs font-bold text-amber-700">Abrir Ajustes</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (locationUnavailable && distanceM === null) {
    return (
      <View className="bg-danger-light rounded-2xl px-4 py-3 flex-row items-center gap-3">
        <Ionicons name="warning-outline" size={20} color="#991B1B" />
        <View className="flex-1">
          <Text className="text-sm font-semibold text-danger">No se pudo obtener tu ubicación</Text>
          <Text className="text-xs text-danger opacity-80 mt-0.5">
            Verifica que el GPS esté activado. Reintentando cada 5 s…
          </Text>
        </View>
      </View>
    );
  }

  const key = distanceM === null ? 'loading' : status;
  const cfg = STATUS_CONFIG[key];

  return (
    <View className={`${cfg.bg} rounded-2xl px-4 py-3 flex-row ${cfg.hint ? 'items-start' : 'items-center'} gap-3`}>
      {/* Pulsing dot */}
      <View className="relative w-8 h-8 items-center justify-center">
        <View className={`w-2.5 h-2.5 rounded-full ${cfg.dot}`} />
      </View>

      <View className="flex-1">
        <Text className={`text-sm font-semibold ${cfg.text}`}>{cfg.label}</Text>
        {distanceM !== null && (
          <Text className={`text-xs mt-0.5 ${cfg.text} opacity-80`}>
            {formatDistance(distanceM)} del punto de marcaje
          </Text>
        )}
        {cfg.hint && (
          <Text className={`text-xs mt-1 ${cfg.text}`}>
            {cfg.hint}
          </Text>
        )}
      </View>

      {distanceM !== null && (
        <View className={`rounded-xl px-3 py-1 ${cfg.bg} border border-current opacity-70`}>
          <Text className={`text-xs font-bold ${cfg.text}`}>
            {formatDistance(distanceM)}
          </Text>
        </View>
      )}
    </View>
  );
}
