import React, { useState } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity,
  ScrollView, Alert, ActivityIndicator, Image, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
// ponytail: lazy import — native module only loaded when handler runs, not at route discovery time
import type { TipoNovedad } from '@api-client';
import { useCrearNovedad } from './useNovedades';

const TIPOS: { value: TipoNovedad; label: string; icon: React.ComponentProps<typeof Ionicons>['name'] }[] = [
  { value: 'retraso',   label: 'Retraso',   icon: 'time-outline' },
  { value: 'ausencia',  label: 'Ausencia',  icon: 'person-remove-outline' },
  { value: 'incidente', label: 'Incidente', icon: 'warning-outline' },
  { value: 'otro',      label: 'Otro',      icon: 'chatbubble-outline' },
];

interface Props {
  visible: boolean;
  asignacionId: number;
  onClose: () => void;
}

function toLocalIso(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
}

export function ReportarNovedadModal({ visible, asignacionId, onClose }: Props) {
  const [tipo, setTipo] = useState<TipoNovedad>('retraso');
  const [descripcion, setDescripcion] = useState('');
  const [horaEvento, setHoraEvento] = useState<string | null>(null);
  const [fotoB64, setFotoB64] = useState<string | null>(null);
  const mutation = useCrearNovedad(asignacionId);

  const handlePickFoto = async () => {
    const ImagePicker = await import('expo-image-picker');
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permiso requerido', 'Permite el acceso a la galería para adjuntar una foto.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.5,
      base64: true,
    });
    if (!result.canceled && result.assets[0]?.base64) {
      setFotoB64(result.assets[0].base64);
    }
  };

  const handleTakePhoto = async () => {
    const ImagePicker = await import('expo-image-picker');
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permiso requerido', 'Permite el acceso a la cámara para tomar una foto.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.5,
      base64: true,
    });
    if (!result.canceled && result.assets[0]?.base64) {
      setFotoB64(result.assets[0].base64);
    }
  };

  const handleFoto = () => {
    Alert.alert('Adjuntar foto', undefined, [
      { text: 'Tomar foto', onPress: handleTakePhoto },
      { text: 'Galería', onPress: handlePickFoto },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  };

  const handleUsarAhora = () => setHoraEvento(toLocalIso(new Date()));

  /** GPS del momento del reporte — opcional, nunca bloquea el envío si falla o se niega el permiso. */
  const obtenerUbicacionActual = async (): Promise<{ latitud?: number; longitud?: number }> => {
    try {
      const Location = await import('expo-location');
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return {};
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      return { latitud: loc.coords.latitude, longitud: loc.coords.longitude };
    } catch {
      return {};
    }
  };

  const handleEnviar = async () => {
    if (!descripcion.trim()) {
      Alert.alert('Campo requerido', 'Escribe una descripción de la novedad.');
      return;
    }
    try {
      const { latitud, longitud } = await obtenerUbicacionActual();
      await mutation.mutateAsync({
        tipo,
        descripcion: descripcion.trim(),
        hora_evento: horaEvento || undefined,
        foto_b64: fotoB64 || undefined,
        latitud,
        longitud,
      });
      setDescripcion('');
      setTipo('retraso');
      setHoraEvento(null);
      setFotoB64(null);
      onClose();
    } catch {
      Alert.alert('Error', 'No se pudo reportar la novedad. Intenta de nuevo.');
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View className="flex-1 bg-background">
        {/* Header */}
        <View className="flex-row items-center justify-between px-5 py-4 border-b border-border">
          <Text className="text-base font-bold text-foreground">Reportar novedad</Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close" size={22} color="#64748B" />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerClassName="px-5 py-5 gap-5" keyboardShouldPersistTaps="handled">
          {/* Tipo */}
          <View className="gap-2">
            <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Tipo</Text>
            <View className="flex-row flex-wrap gap-2">
              {TIPOS.map((t) => {
                const sel = tipo === t.value;
                return (
                  <TouchableOpacity
                    key={t.value}
                    onPress={() => setTipo(t.value)}
                    className={`flex-row items-center gap-1.5 px-3 py-2 rounded-xl border ${sel ? 'bg-primary border-primary' : 'bg-card border-border'}`}
                  >
                    <Ionicons name={t.icon} size={14} color={sel ? '#fff' : '#64748B'} />
                    <Text className={`text-sm font-medium ${sel ? 'text-white' : 'text-foreground'}`}>{t.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Descripción */}
          <View className="gap-2">
            <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Descripción</Text>
            <TextInput
              value={descripcion}
              onChangeText={setDescripcion}
              placeholder="Describe la situación…"
              placeholderTextColor="#94A3B8"
              multiline
              numberOfLines={4}
              maxLength={1000}
              className="text-sm text-foreground border border-border rounded-xl px-4 py-3 min-h-[100px]"
              textAlignVertical="top"
            />
            <Text className="text-xs text-muted-foreground text-right">{descripcion.length}/1000</Text>
          </View>

          {/* Hora del evento */}
          <View className="gap-2">
            <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Hora del evento</Text>
            {horaEvento ? (
              <View className="flex-row items-center gap-2 bg-muted rounded-xl px-4 py-3">
                <Ionicons name="time-outline" size={16} color="#64748B" />
                <Text className="flex-1 text-sm text-foreground">{horaEvento.replace('T', ' ').slice(0, 16)}</Text>
                <TouchableOpacity onPress={() => setHoraEvento(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="close-circle" size={18} color="#94A3B8" />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                onPress={handleUsarAhora}
                className="flex-row items-center gap-2 bg-muted rounded-xl px-4 py-3"
              >
                <Ionicons name="time-outline" size={16} color="#64748B" />
                <Text className="text-sm text-muted-foreground">Usar hora actual</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Foto */}
          <View className="gap-2">
            <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Foto (opcional)</Text>
            {fotoB64 ? (
              <View className="gap-2">
                <Image
                  source={{ uri: `data:image/jpeg;base64,${fotoB64}` }}
                  className="w-full h-48 rounded-xl"
                  resizeMode="cover"
                />
                <TouchableOpacity
                  onPress={() => setFotoB64(null)}
                  className="flex-row items-center gap-1.5 self-start px-3 py-1.5 bg-muted rounded-xl"
                >
                  <Ionicons name="trash-outline" size={14} color="#DC2626" />
                  <Text className="text-xs font-medium text-danger">Quitar foto</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                onPress={handleFoto}
                className="flex-row items-center gap-2 bg-muted rounded-xl px-4 py-3 border border-dashed border-border"
              >
                <Ionicons name="camera-outline" size={18} color="#64748B" />
                <Text className="text-sm text-muted-foreground">Adjuntar foto</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Botón */}
          <TouchableOpacity
            onPress={handleEnviar}
            disabled={mutation.isPending}
            className="bg-primary rounded-2xl py-4 items-center flex-row justify-center gap-2"
            style={{ opacity: mutation.isPending ? 0.6 : 1 }}
          >
            {mutation.isPending
              ? <ActivityIndicator size="small" color="#fff" />
              : <Ionicons name="send-outline" size={18} color="#fff" />}
            <Text className="text-white font-semibold text-base">
              {mutation.isPending ? 'Enviando…' : 'Enviar novedad'}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  );
}
