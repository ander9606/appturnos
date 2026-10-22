import React from 'react';
import { View } from 'react-native';
import { Controller, type Control } from 'react-hook-form';
import { Text } from '@/components/ui/Text';
import type { FormData } from './miEmpresaForm';

interface Opcion { value: string; label: string; sub: string }

/** Título + descripción + opciones en fila (una activa). Lo usan el ciclo de nómina y el régimen de contratación. */
export function SeccionOpciones({ control, name, title, description, options }: {
  control: Control<FormData>;
  name: 'tipo_liquidacion' | 'tipo_contrato';
  title: string;
  description: string;
  options: Opcion[];
}) {
  return (
    <View className="gap-3 mt-2">
      <View className="gap-1">
        <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
          {title}
        </Text>
        <Text className="text-xs text-muted-foreground">
          {description}
        </Text>
      </View>
      <Controller
        control={control}
        name={name}
        render={({ field: { onChange, value } }) => (
          <View className="flex-row gap-2">
            {options.map((opt) => {
              const active = value === opt.value;
              return (
                <View
                  key={opt.value}
                  className={`flex-1 rounded-2xl border py-3 px-2 items-center gap-0.5 ${
                    active ? 'border-primary-500 bg-primary/10' : 'border-border bg-card'
                  }`}
                  // ponytail: TouchableOpacity wrapping needed
                >
                  <Text
                    onPress={() => onChange(opt.value)}
                    className={`text-sm font-bold ${active ? 'text-primary-500' : 'text-foreground'}`}
                  >
                    {opt.label}
                  </Text>
                  <Text className="text-[10px] text-muted-foreground text-center">{opt.sub}</Text>
                </View>
              );
            })}
          </View>
        )}
      />
    </View>
  );
}
