import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  Pressable,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { validateStep1 } from './utils';
import type { WizardData, TipoDocumento, Sexo } from './types';
import { authApi } from '@api-client';

const TIPO_LABEL: Record<string, string> = {
  turnos: 'Trabajador de Turnos',
  nomina: 'Trabajador de Nómina',
  ambos:  'Trabajador de Turnos y Nómina',
};

// ── Local helpers ──────────────────────────────────────────────────────────

function SegInput({
  label, value, onChange, maxLength = 2, placeholder,
}: {
  label: string; value: string; onChange: (v: string) => void;
  maxLength?: number; placeholder: string;
}) {
  return (
    <View className="items-center gap-1">
      <Text className="text-xs text-muted-foreground">{label}</Text>
      <TextInput
        className="bg-muted rounded-xl text-center text-base font-semibold text-foreground"
        style={{ width: maxLength === 4 ? 72 : 48, height: 44 }}
        value={value}
        onChangeText={(t) => onChange(t.replace(/\D/g, '').slice(0, maxLength))}
        keyboardType="number-pad"
        placeholder={placeholder}
        placeholderTextColor="#94A3B8"
        maxLength={maxLength}
      />
    </View>
  );
}

function PillRow<T extends string>({
  options, value, onChange,
}: {
  options: { v: T; label: string }[];
  value: T | '';
  onChange: (v: T) => void;
}) {
  return (
    <View className="flex-row flex-wrap gap-2">
      {options.map(({ v, label }) => {
        const active = value === v;
        return (
          <Pressable
            key={v}
            onPress={() => onChange(v)}
            className={`px-4 py-2 rounded-xl border ${
              active ? 'bg-primary-500 border-primary-500' : 'bg-card border-border'
            }`}
          >
            <Text className={`text-sm font-semibold ${active ? 'text-white' : 'text-muted-foreground'}`}>
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ── Props ──────────────────────────────────────────────────────────────────

type Props = {
  data: WizardData;
  onChange: (patch: Partial<WizardData>) => void;
  onNext: () => void;
};

// ── Component ──────────────────────────────────────────────────────────────

export function Step1DatosPersonales({ data, onChange, onNext }: Props) {
  const router = useRouter();

  const handleNext = async () => {
    const err = validateStep1(data);
    if (err) { Alert.alert('Datos incompletos', err); return; }

    if (data.cedula.length >= 4) {
      try {
        const res = await authApi.verificarCedula(data.cedula);
        if (res.existe && res.invitacion) {
          Alert.alert(
            'Ya tienes una invitación',
            `Tu cédula tiene una invitación pendiente de "${res.invitacion.empresa_nombre}" como ${TIPO_LABEL[res.tipo ?? ''] ?? res.tipo}.\n\nPara acceder, activa tu cuenta desde la pantalla de activación.`,
            [
              { text: 'Activar cuenta', onPress: () => router.replace('/(auth)/activar') },
              { text: 'Cancelar', style: 'cancel' },
            ],
          );
          return;
        }
      } catch {
        // Si falla el check no bloqueamos el flujo
      }
    }

    onNext();
  };

  return (
    <ScrollView
      contentContainerClassName="px-5 py-4 gap-5 pb-10"
      keyboardShouldPersistTaps="handled"
    >
      {/* Nombre + Apellido */}
      <View className="flex-row gap-3">
        <View className="flex-1">
          <Input
            label="Nombre *"
            placeholder="Juan"
            value={data.nombre}
            onChangeText={(t) => onChange({ nombre: t })}
            autoCapitalize="words"
          />
        </View>
        <View className="flex-1">
          <Input
            label="Apellido *"
            placeholder="Pérez"
            value={data.apellido}
            onChangeText={(t) => onChange({ apellido: t })}
            autoCapitalize="words"
          />
        </View>
      </View>

      {/* Tipo de trabajador */}
      <View className="gap-1.5">
        <Text className="text-sm font-semibold text-foreground">Tipo *</Text>
        <PillRow
          options={[
            { v: 'turnos' as const, label: 'Turnos' },
            { v: 'nomina' as const, label: 'Nómina' },
            { v: 'ambos' as const, label: 'Ambos' },
          ]}
          value={data.tipo}
          onChange={(v) => onChange({ tipo: v })}
        />
      </View>

      {/* Documento */}
      <View className="gap-2">
        <Text className="text-sm font-semibold text-foreground">Tipo de documento *</Text>
        <PillRow<TipoDocumento>
          options={[
            { v: 'CC', label: 'Cédula (CC)' },
            { v: 'CE', label: 'Cédula extranjería' },
            { v: 'PAS', label: 'Pasaporte' },
          ]}
          value={data.tipo_documento}
          onChange={(v) => onChange({ tipo_documento: v })}
        />
        <Input
          placeholder="Número de documento *"
          value={data.cedula}
          onChangeText={(t) => onChange({ cedula: t })}
          keyboardType="numeric"
        />
      </View>

      {/* Fecha de nacimiento */}
      <View className="gap-2">
        <Text className="text-sm font-semibold text-foreground">Fecha de nacimiento</Text>
        <View className="flex-row items-end gap-3">
          <SegInput label="Día"  value={data.nac_d} onChange={(v) => onChange({ nac_d: v })} placeholder="15" />
          <Text className="text-muted-foreground mb-3">/</Text>
          <SegInput label="Mes"  value={data.nac_m} onChange={(v) => onChange({ nac_m: v })} placeholder="06" />
          <Text className="text-muted-foreground mb-3">/</Text>
          <SegInput label="Año"  value={data.nac_a} onChange={(v) => onChange({ nac_a: v })} placeholder="1995" maxLength={4} />
        </View>
      </View>

      {/* Sexo */}
      <View className="gap-1.5">
        <Text className="text-sm font-semibold text-foreground">Sexo</Text>
        <PillRow<Sexo>
          options={[
            { v: 'M', label: 'Masculino' },
            { v: 'F', label: 'Femenino' },
            { v: 'otro', label: 'Otro' },
          ]}
          value={data.sexo}
          onChange={(v) => onChange({ sexo: v })}
        />
      </View>

      {/* Contacto */}
      <View className="gap-3">
        <Input
          label="Teléfono"
          placeholder="+57 300 000 0000"
          value={data.telefono}
          onChangeText={(t) => onChange({ telefono: t })}
          keyboardType="phone-pad"
        />
        <Input
          label="Correo electrónico"
          placeholder="trabajador@empresa.com"
          value={data.email}
          onChangeText={(t) => onChange({ email: t })}
          keyboardType="email-address"
          autoCapitalize="none"
        />
      </View>

      {/* Contacto de emergencia */}
      <View className="gap-3">
        <View className="flex-row items-center gap-3">
          <View className="flex-1 h-px bg-border" />
          <Text className="text-xs text-muted-foreground font-medium">CONTACTO DE EMERGENCIA</Text>
          <View className="flex-1 h-px bg-border" />
        </View>
        <Input
          label="Nombre del contacto"
          placeholder="María García"
          value={data.emergencia_nombre}
          onChangeText={(t) => onChange({ emergencia_nombre: t })}
          autoCapitalize="words"
        />
        <Input
          label="Teléfono del contacto"
          placeholder="+57 311 000 0000"
          value={data.emergencia_tel}
          onChangeText={(t) => onChange({ emergencia_tel: t })}
          keyboardType="phone-pad"
        />
      </View>

      <Button label="Siguiente →" variant="primary" size="lg" fullWidth onPress={handleNext} />
    </ScrollView>
  );
}
