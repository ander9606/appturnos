import React, { useState } from 'react';
import { View, Text, Image, TouchableOpacity, Modal, Linking } from 'react-native';
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
  const [fotoVisible, setFotoVisible] = useState(false);
  const fotoUri = novedad.foto_b64 ? `data:image/jpeg;base64,${novedad.foto_b64}` : null;

  return (
    <View className="py-3 border-b border-border last:border-0 gap-2">
      <View className="flex-row gap-3">
        <View className="w-8 h-8 rounded-xl items-center justify-center mt-0.5" style={{ backgroundColor: cfg.color + '20' }}>
          <Ionicons name={cfg.icon} size={16} color={cfg.color} />
        </View>
        <View className="flex-1 gap-0.5">
          <View className="flex-row items-center gap-2 flex-wrap">
            <Text className="text-xs font-semibold" style={{ color: cfg.color }}>{cfg.label}</Text>
            <Text className="text-xs text-muted-foreground">·</Text>
            <Text className="text-xs text-muted-foreground">{novedad.autor_nombre} {novedad.autor_apellido}</Text>
          </View>
          <Text className="text-sm text-foreground leading-5">{novedad.descripcion}</Text>
          <View className="flex-row items-center gap-3 mt-0.5">
            {novedad.hora_evento && (
              <View className="flex-row items-center gap-1">
                <Ionicons name="time-outline" size={11} color="#94A3B8" />
                <Text className="text-xs text-muted-foreground">{fmtTs(novedad.hora_evento)}</Text>
              </View>
            )}
            <Text className="text-xs text-muted-foreground">{fmtTs(novedad.created_at)}</Text>
            {novedad.latitud != null && novedad.longitud != null && (
              <TouchableOpacity
                onPress={() => Linking.openURL(`https://maps.google.com/?q=${novedad.latitud},${novedad.longitud}`)}
                className="flex-row items-center gap-1"
              >
                <Ionicons name="location-outline" size={11} color="#0284C7" />
                <Text className="text-xs text-primary">Ver ubicación</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>

      {/* Thumbnail de foto */}
      {fotoUri && (
        <TouchableOpacity onPress={() => setFotoVisible(true)} className="ml-11">
          <Image
            source={{ uri: fotoUri }}
            className="w-24 h-24 rounded-xl"
            resizeMode="cover"
          />
        </TouchableOpacity>
      )}

      {/* Visor de foto a pantalla completa */}
      {fotoUri && (
        <Modal visible={fotoVisible} transparent animationType="fade" onRequestClose={() => setFotoVisible(false)}>
          <TouchableOpacity
            className="flex-1 bg-black/90 items-center justify-center"
            onPress={() => setFotoVisible(false)}
            activeOpacity={1}
          >
            <Image source={{ uri: fotoUri }} className="w-full" style={{ height: '80%' }} resizeMode="contain" />
          </TouchableOpacity>
        </Modal>
      )}
    </View>
  );
}
