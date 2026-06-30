import React, { useState } from 'react';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useCrearAusencia } from '@/features/ausencias/useAusencias';
import { useTheme } from '@/lib/theme';
import { Button } from '@/components/ui/Button';
import type { TipoAusencia } from '@api-client';

const TIPOS: { key: TipoAusencia; label: string }[] = [
  { key: 'vacaciones', label: 'Vacaciones' },
  { key: 'permiso',    label: 'Permiso' },
  { key: 'incapacidad',label: 'Incapacidad' },
  { key: 'otro',       label: 'Otro' },
];

function isoDate(d: Date) { return d.toISOString().slice(0, 10); }

export default function AusenciaNuevaScreen() {
  const router = useRouter();
  const theme  = useTheme();
  const crear  = useCrearAusencia();

  const [tipo,      setTipo]      = useState<TipoAusencia>('vacaciones');
  const [inicio,    setInicio]    = useState(new Date());
  const [fin,       setFin]       = useState(new Date());
  const [motivo,    setMotivo]    = useState('');
  const [picker,    setPicker]    = useState<'inicio' | 'fin' | null>(null);

  async function handleGuardar() {
    if (isoDate(fin) < isoDate(inicio)) {
      Alert.alert('Error', 'La fecha de fin no puede ser antes del inicio.');
      return;
    }
    try {
      await crear.mutateAsync({ tipo, fecha_inicio: isoDate(inicio), fecha_fin: isoDate(fin), motivo: motivo.trim() || undefined });
      Alert.alert('Enviado', 'Tu solicitud fue enviada al gestor.');
      router.back();
    } catch {
      Alert.alert('Error', 'No se pudo enviar la solicitud.');
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['bottom']}>
      <ScrollView contentContainerClassName="px-5 py-5 gap-5 pb-12" showsVerticalScrollIndicator={false}>

        {/* Tipo */}
        <View className="gap-2">
          <Text className="text-sm font-semibold text-foreground">Tipo de ausencia</Text>
          <View className="flex-row flex-wrap gap-2">
            {TIPOS.map(({ key, label }) => (
              <TouchableOpacity
                key={key}
                onPress={() => setTipo(key)}
                className="px-4 py-2 rounded-xl border"
                style={{
                  borderColor: tipo === key ? theme.primary : '#E2E8F0',
                  backgroundColor: tipo === key ? theme.primary + '1A' : '#F8FAFC',
                }}
              >
                <Text className="text-sm font-medium" style={{ color: tipo === key ? theme.primary : '#64748B' }}>
                  {label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Rango de fechas */}
        <View className="gap-2">
          <Text className="text-sm font-semibold text-foreground">Fechas</Text>
          <View className="flex-row gap-3">
            <TouchableOpacity
              onPress={() => setPicker('inicio')}
              className="flex-1 bg-card border border-border rounded-xl px-4 py-3 flex-row items-center gap-2"
            >
              <Ionicons name="calendar-outline" size={16} color="#64748B" />
              <View>
                <Text className="text-xs text-muted-foreground">Desde</Text>
                <Text className="text-sm font-medium text-foreground">{isoDate(inicio)}</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setPicker('fin')}
              className="flex-1 bg-card border border-border rounded-xl px-4 py-3 flex-row items-center gap-2"
            >
              <Ionicons name="calendar-outline" size={16} color="#64748B" />
              <View>
                <Text className="text-xs text-muted-foreground">Hasta</Text>
                <Text className="text-sm font-medium text-foreground">{isoDate(fin)}</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* Motivo */}
        <View className="gap-2">
          <Text className="text-sm font-semibold text-foreground">Motivo (opcional)</Text>
          <TextInput
            value={motivo}
            onChangeText={setMotivo}
            placeholder="Describe brevemente el motivo..."
            placeholderTextColor="#94A3B8"
            multiline
            numberOfLines={3}
            maxLength={500}
            className="bg-card border border-border rounded-xl px-4 py-3 text-sm text-foreground"
            style={{ textAlignVertical: 'top', minHeight: 72 }}
          />
        </View>

        <Button
          label={crear.isPending ? 'Enviando…' : 'Enviar solicitud'}
          variant="primary"
          fullWidth
          loading={crear.isPending}
          onPress={handleGuardar}
        />
      </ScrollView>

      {picker && (
        <DateTimePicker
          mode="date"
          display="default"
          value={picker === 'inicio' ? inicio : fin}
          minimumDate={picker === 'fin' ? inicio : new Date()}
          onChange={(_, date) => {
            setPicker(null);
            if (!date) return;
            if (picker === 'inicio') setInicio(date);
            else setFin(date);
          }}
        />
      )}
    </SafeAreaView>
  );
}
