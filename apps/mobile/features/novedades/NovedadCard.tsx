import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Novedad, TipoNovedad } from '@api-client';

const TIPO_CONFIG: Record<TipoNovedad, { icon: React.ComponentProps<typeof Ionicons>['name']; color: string; label: string }> = {
  retraso:   { icon: 'time-outline',          color: '#D97706', label: 'Retraso' },
  ausencia:  { icon: 'person-remove-outline', color: '#DC2626', label: 'Ausencia' },
  incidente: { icon: 'warning-outline',       color: '#7C3AED', label: 'Incidente' },
  otro:      { icon: 'chatbubble-outline',    color: '#0284C7', label: 'Novedad' },
};

function fmtTs(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export function NovedadCard({ novedad }: { novedad: Novedad }) {
  const cfg = TIPO_CONFIG[novedad.tipo];
  return (
    <View className="flex-row gap-3 py-3 border-b border-border last:border-0">
      <View className="w-8 h-8 rounded-xl items-center justify-center mt-0.5" style={{ backgroundColor: cfg.color + '20' }}>
        <Ionicons name={cfg.icon} size={16} color={cfg.color} />
      </View>
      <View className="flex-1 gap-0.5">
        <View className="flex-row items-center gap-2">
          <Text className="text-xs font-semibold" style={{ color: cfg.color }}>{cfg.label}</Text>
          <Text className="text-xs text-muted-foreground">·</Text>
          <Text className="text-xs text-muted-foreground">{novedad.autor_nombre} {novedad.autor_apellido}</Text>
        </View>
        <Text className="text-sm text-foreground leading-5">{novedad.descripcion}</Text>
        <Text className="text-xs text-muted-foreground mt-0.5">{fmtTs(novedad.created_at)}</Text>
      </View>
    </View>
  );
}
