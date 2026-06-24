import React, { useState } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity,
  ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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

export function ReportarNovedadModal({ visible, asignacionId, onClose }: Props) {
  const [tipo, setTipo] = useState<TipoNovedad>('retraso');
  const [descripcion, setDescripcion] = useState('');
  const mutation = useCrearNovedad(asignacionId);

  const handleEnviar = async () => {
    if (!descripcion.trim()) {
      Alert.alert('Campo requerido', 'Escribe una descripción de la novedad.');
      return;
    }
    try {
      await mutation.mutateAsync({ tipo, descripcion: descripcion.trim() });
      setDescripcion('');
      setTipo('retraso');
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

        <ScrollView contentContainerClassName="px-5 py-5 gap-5">
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
