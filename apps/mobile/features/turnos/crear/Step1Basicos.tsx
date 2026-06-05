import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';

import { Button } from '@/components/ui/Button';
import { SegmentInput } from './SegmentInput';
import { validateStep1 } from './utils';
import type { WizardData } from './types';

type Props = {
  data: WizardData;
  onChange: (patch: Partial<WizardData>) => void;
  onNext: () => void;
};

export function Step1Basicos({ data, onChange, onNext }: Props) {
  const [locLoading, setLocLoading] = useState(false);

  const usarUbicacion = async () => {
    setLocLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permiso denegado', 'Activa los permisos de ubicación en ajustes.');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      onChange({ latitud: pos.coords.latitude, longitud: pos.coords.longitude });
    } catch {
      Alert.alert('Error', 'No se pudo obtener la ubicación.');
    } finally {
      setLocLoading(false);
    }
  };

  const handleNext = () => {
    const err = validateStep1(data);
    if (err) { Alert.alert('Datos incompletos', err); return; }
    onNext();
  };

  return (
    <ScrollView
      contentContainerClassName="px-5 py-4 gap-5 pb-10"
      keyboardShouldPersistTaps="handled"
    >
      <View className="gap-1.5">
        <Text className="text-sm font-semibold text-foreground">Título del turno *</Text>
        <TextInput
          className="bg-muted rounded-2xl px-4 py-3 text-base text-foreground"
          placeholder="Ej: Montaje feria Corferias — auxiliares"
          placeholderTextColor="#94A3B8"
          value={data.titulo}
          onChangeText={(t) => onChange({ titulo: t })}
          returnKeyType="next"
        />
      </View>

      <View className="gap-1.5">
        <Text className="text-sm font-semibold text-foreground">Descripción</Text>
        <TextInput
          className="bg-muted rounded-2xl px-4 py-3 text-base text-foreground"
          placeholder="Instrucciones, requisitos, qué llevar… (opcional)"
          placeholderTextColor="#94A3B8"
          value={data.descripcion}
          onChangeText={(t) => onChange({ descripcion: t })}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
          style={{ minHeight: 72 }}
        />
      </View>

      <View className="gap-2">
        <Text className="text-sm font-semibold text-foreground">Fecha *</Text>
        <View className="flex-row items-end gap-3">
          <SegmentInput label="Día"  value={data.dia}  onChange={(v) => onChange({ dia: v })}  placeholder="15" />
          <Text className="text-muted-foreground mb-3">/</Text>
          <SegmentInput label="Mes"  value={data.mes}  onChange={(v) => onChange({ mes: v })}  placeholder="06" />
          <Text className="text-muted-foreground mb-3">/</Text>
          <SegmentInput label="Año"  value={data.anio} onChange={(v) => onChange({ anio: v })} placeholder="2026" maxLength={4} />
        </View>
      </View>

      <View className="gap-2">
        <Text className="text-sm font-semibold text-foreground">Horario *</Text>
        <View className="flex-row gap-6">
          <View className="gap-1.5">
            <Text className="text-xs text-muted-foreground">Inicio</Text>
            <View className="flex-row items-end gap-1">
              <SegmentInput label="HH" value={data.hora_inicio_h} onChange={(v) => onChange({ hora_inicio_h: v })} placeholder="07" />
              <Text className="text-muted-foreground mb-3 font-bold">:</Text>
              <SegmentInput label="mm" value={data.hora_inicio_m} onChange={(v) => onChange({ hora_inicio_m: v })} placeholder="00" />
            </View>
          </View>

          <View className="gap-1.5">
            <Text className="text-xs text-muted-foreground">Fin estimado</Text>
            <View className="flex-row items-end gap-1">
              <SegmentInput label="HH" value={data.hora_fin_h} onChange={(v) => onChange({ hora_fin_h: v })} placeholder="15" />
              <Text className="text-muted-foreground mb-3 font-bold">:</Text>
              <SegmentInput label="mm" value={data.hora_fin_m} onChange={(v) => onChange({ hora_fin_m: v })} placeholder="00" />
            </View>
          </View>
        </View>
      </View>

      <View className="gap-1.5">
        <Text className="text-sm font-semibold text-foreground">Lugar</Text>
        <TextInput
          className="bg-muted rounded-2xl px-4 py-3 text-base text-foreground"
          placeholder="Ej: Corferias, Cra 37 #24-67, Bogotá"
          placeholderTextColor="#94A3B8"
          value={data.lugar}
          onChangeText={(t) => onChange({ lugar: t })}
        />
        <TouchableOpacity
          className="flex-row items-center gap-2 self-start mt-1 px-3 py-2 bg-muted rounded-xl"
          onPress={usarUbicacion}
          disabled={locLoading}
        >
          {locLoading
            ? <ActivityIndicator size="small" color="#3B82F6" />
            : <Ionicons name="location-outline" size={16} color="#3B82F6" />}
          <Text className="text-sm font-medium text-info">
            {locLoading ? 'Obteniendo GPS…' : 'Usar mi ubicación actual'}
          </Text>
        </TouchableOpacity>
        {data.latitud !== null && (
          <View className="flex-row items-center gap-1.5 mt-1">
            <Ionicons name="checkmark-circle" size={14} color="#059669" />
            <Text className="text-xs text-success">
              GPS capturado: {data.latitud.toFixed(5)}, {data.longitud?.toFixed(5)}
            </Text>
          </View>
        )}
      </View>

      <Button label="Siguiente →" variant="primary" size="lg" fullWidth onPress={handleNext} />
    </ScrollView>
  );
}
