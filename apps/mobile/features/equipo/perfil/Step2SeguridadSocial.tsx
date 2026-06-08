import React from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Alert,
} from 'react-native';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { validateStep2 } from './utils';
import type { WizardData, TipoCuenta } from './types';

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

type Props = {
  data: WizardData;
  onChange: (patch: Partial<WizardData>) => void;
  onBack: () => void;
  onNext: () => void;
};

export function Step2SeguridadSocial({ data, onChange, onBack, onNext }: Props) {
  const handleNext = () => {
    const err = validateStep2(data);
    if (err) { Alert.alert('Datos incompletos', err); return; }
    onNext();
  };

  return (
    <ScrollView
      contentContainerClassName="px-5 py-4 gap-5 pb-10"
      keyboardShouldPersistTaps="handled"
    >
      {/* Seguridad social */}
      <View className="gap-3">
        <View className="flex-row items-center gap-3">
          <View className="flex-1 h-px bg-border" />
          <Text className="text-xs text-muted-foreground font-medium">SEGURIDAD SOCIAL</Text>
          <View className="flex-1 h-px bg-border" />
        </View>
        <Input
          label="EPS (entidad promotora de salud)"
          placeholder="Ej. Sura, Nueva EPS, Compensar…"
          value={data.eps}
          onChangeText={(t) => onChange({ eps: t })}
          autoCapitalize="words"
        />
        <Input
          label="AFP (fondo de pensiones)"
          placeholder="Ej. Protección, Porvenir, Colpensiones…"
          value={data.afp}
          onChangeText={(t) => onChange({ afp: t })}
          autoCapitalize="words"
        />
      </View>

      {/* Cuenta bancaria */}
      <View className="gap-3">
        <View className="flex-row items-center gap-3">
          <View className="flex-1 h-px bg-border" />
          <Text className="text-xs text-muted-foreground font-medium">CUENTA BANCARIA</Text>
          <View className="flex-1 h-px bg-border" />
        </View>
        <Input
          label="Banco"
          placeholder="Ej. Bancolombia, Davivienda, Nequi…"
          value={data.banco}
          onChangeText={(t) => onChange({ banco: t })}
          autoCapitalize="words"
        />
        <View className="gap-1.5">
          <Text className="text-sm font-semibold text-foreground">Tipo de cuenta</Text>
          <PillRow<TipoCuenta>
            options={[
              { v: 'ahorros', label: 'Ahorros' },
              { v: 'corriente', label: 'Corriente' },
            ]}
            value={data.tipo_cuenta}
            onChange={(v) => onChange({ tipo_cuenta: v })}
          />
        </View>
        <Input
          label="Número de cuenta"
          placeholder="Número de la cuenta"
          value={data.numero_cuenta}
          onChangeText={(t) => onChange({ numero_cuenta: t })}
          keyboardType="numeric"
        />
      </View>

      {/* Compensación */}
      <View className="gap-3">
        <View className="flex-row items-center gap-3">
          <View className="flex-1 h-px bg-border" />
          <Text className="text-xs text-muted-foreground font-medium">COMPENSACIÓN (opcional)</Text>
          <View className="flex-1 h-px bg-border" />
        </View>
        <Text className="text-xs text-muted-foreground -mt-2">
          Solo uno es necesario. Tarifa/hora tiene prioridad sobre salario mensual.
        </Text>
        <Input
          label="Tarifa por hora (COP)"
          placeholder="Ej. 8500"
          value={data.tarifa_hora}
          onChangeText={(t) => onChange({ tarifa_hora: t })}
          keyboardType="numeric"
        />
        <Input
          label="Salario base mensual (COP)"
          placeholder="Ej. 1300000"
          hint="Se divide entre 240 para obtener el valor/hora."
          value={data.salario_base}
          onChangeText={(t) => onChange({ salario_base: t })}
          keyboardType="numeric"
        />
      </View>

      {/* Navigation */}
      <View className="flex-row gap-3">
        <View className="flex-1">
          <Button label="← Atrás" variant="secondary" size="lg" fullWidth onPress={onBack} />
        </View>
        <View className="flex-1">
          <Button label="Siguiente →" variant="primary" size="lg" fullWidth onPress={handleNext} />
        </View>
      </View>
    </ScrollView>
  );
}
