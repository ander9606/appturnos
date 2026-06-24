import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Button }      from '@/components/ui/Button';
import { SegmentInput } from './SegmentInput';
import { LugarInput }   from './LugarInput';
import { validateStep1 } from './utils';
import type { WizardData } from './types';

type Props = {
  data: WizardData;
  onChange: (patch: Partial<WizardData>) => void;
  onNext: () => void;
};

export function Step1Basicos({ data, onChange, onNext }: Props) {
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
        <LugarInput
          value={data.lugar}
          latitud={data.latitud}
          longitud={data.longitud}
          onChange={(lugar, lat, lng) => onChange({ lugar, latitud: lat, longitud: lng })}
        />
      </View>

      {/* Destinatarios */}
      <View className="gap-2">
        <Text className="text-sm font-semibold text-foreground">Destinatarios</Text>
        <Text className="text-xs text-muted-foreground -mt-1">¿A quién va dirigido este turno?</Text>
        <View className="flex-row gap-2">
          {([
            { value: 'turnos', label: 'Trabajadores\nturnos' },
            { value: 'nomina', label: 'Personal\nnómina' },
            { value: 'ambos',  label: 'Ambos' },
          ] as const).map((opt) => {
            const active = data.para_quien === opt.value;
            return (
              <TouchableOpacity
                key={opt.value}
                onPress={() => onChange({ para_quien: opt.value })}
                className={`flex-1 rounded-2xl border py-3 px-2 items-center ${
                  active ? 'border-primary bg-primary/10' : 'border-border bg-card'
                }`}
              >
                <Text className={`text-xs font-bold text-center ${active ? 'text-primary' : 'text-foreground'}`}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <Button label="Siguiente →" variant="primary" size="lg" fullWidth onPress={handleNext} />
    </ScrollView>
  );
}
