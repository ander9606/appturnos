import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, Switch, Alert, ActivityIndicator, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { trabajadoresApi } from '@api-client';
import type { DisponibilidadSlot } from '@api-client';
import { useTheme } from '@/lib/theme';
import { Button } from '@/components/ui/Button';

const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

function timeToDate(hhmm: string): Date {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
}

function dateToHHMM(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

type LocalSlot = DisponibilidadSlot & { picker?: 'inicio' | 'fin' };

export default function DisponibilidadScreen() {
  const theme = useTheme();
  const qc = useQueryClient();

  const { data: serverSlots, isLoading } = useQuery({
    queryKey: ['disponibilidad', 'me'],
    queryFn: () => trabajadoresApi.obtenerDisponibilidad(),
    staleTime: 60_000,
  });

  const [slots, setSlots] = useState<LocalSlot[]>([]);
  const [pickerIdx, setPickerIdx] = useState<number | null>(null);
  const [pickerField, setPickerField] = useState<'inicio' | 'fin'>('inicio');

  useEffect(() => {
    const base: LocalSlot[] = DIAS.map((_, dia_semana) => {
      const found = serverSlots?.find((s) => s.dia_semana === dia_semana);
      return found
        ? { ...found }
        : { dia_semana, hora_inicio: '08:00', hora_fin: '17:00', activo: false };
    });
    setSlots(base);
  }, [serverSlots]);

  const guardar = useMutation({
    mutationFn: () => trabajadoresApi.guardarDisponibilidad(slots),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['disponibilidad'] });
      Alert.alert('Guardado', 'Tu disponibilidad fue actualizada.');
    },
    onError: () => Alert.alert('Error', 'No se pudo guardar la disponibilidad.'),
  });

  function toggleActivo(idx: number) {
    setSlots((prev) => prev.map((s, i) => i === idx ? { ...s, activo: !s.activo } : s));
  }

  function openPicker(idx: number, field: 'inicio' | 'fin') {
    setPickerIdx(idx);
    setPickerField(field);
  }

  function onPickerChange(_: unknown, date?: Date) {
    if (pickerIdx === null) return;
    setPickerIdx(null);
    if (!date) return;
    const hhmm = dateToHHMM(date);
    setSlots((prev) => prev.map((s, i) =>
      i === pickerIdx
        ? pickerField === 'inicio' ? { ...s, hora_inicio: hhmm } : { ...s, hora_fin: hhmm }
        : s
    ));
  }

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center" edges={['bottom']}>
        <ActivityIndicator size="large" color={theme.primary} />
      </SafeAreaView>
    );
  }

  const activeSlot = pickerIdx !== null ? slots[pickerIdx] : null;

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['bottom']}>
      <ScrollView contentContainerClassName="px-5 py-5 gap-3 pb-12" showsVerticalScrollIndicator={false}>
        <Text className="text-sm text-muted-foreground mb-1">
          Indica qué días y horarios estás disponible para recibir turnos.
        </Text>

        {slots.map((slot, idx) => (
          <View
            key={slot.dia_semana}
            className="bg-card rounded-2xl px-4 py-4 flex-row items-center gap-4 border border-border"
            style={{ opacity: slot.activo ? 1 : 0.55 }}
          >
            <Text className="w-8 text-sm font-semibold text-foreground">{DIAS[idx]}</Text>

            <Switch
              value={slot.activo}
              onValueChange={() => toggleActivo(idx)}
              trackColor={{ true: theme.primary }}
              thumbColor="#fff"
            />

            {slot.activo && (
              <View className="flex-row items-center gap-2 flex-1 justify-end">
                <TouchableOpacity
                  onPress={() => openPicker(idx, 'inicio')}
                  className="bg-muted px-3 py-1.5 rounded-xl"
                >
                  <Text className="text-sm font-medium text-foreground">{slot.hora_inicio}</Text>
                </TouchableOpacity>
                <Text className="text-muted-foreground text-sm">–</Text>
                <TouchableOpacity
                  onPress={() => openPicker(idx, 'fin')}
                  className="bg-muted px-3 py-1.5 rounded-xl"
                >
                  <Text className="text-sm font-medium text-foreground">{slot.hora_fin}</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        ))}

        <Button
          label={guardar.isPending ? 'Guardando…' : 'Guardar disponibilidad'}
          variant="primary"
          fullWidth
          loading={guardar.isPending}
          onPress={() => guardar.mutate()}
        />
      </ScrollView>

      {pickerIdx !== null && activeSlot && (
        <DateTimePicker
          mode="time"
          display="default"
          value={timeToDate(pickerField === 'inicio' ? activeSlot.hora_inicio : activeSlot.hora_fin)}
          onChange={onPickerChange}
          is24Hour
        />
      )}
    </SafeAreaView>
  );
}
