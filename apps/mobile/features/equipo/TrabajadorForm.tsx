/**
 * TrabajadorForm — shared create/edit form.
 * Uses React Hook Form + Zod. Caller owns the submit handler.
 */
import React from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { trabajadorSchema, TIPO_OPTIONS, type TrabajadorFormValues } from './schemas';
import { Input } from '@/components/ui/Input';

// ── Props ─────────────────────────────────────────────────────────────────

interface TrabajadorFormProps {
  defaultValues?: Partial<TrabajadorFormValues>;
  onSubmit: (data: TrabajadorFormValues) => Promise<void>;
  submitLabel?: string;
  submittingLabel?: string;
}

// ── Component ─────────────────────────────────────────────────────────────

export function TrabajadorForm({
  defaultValues,
  onSubmit,
  submitLabel = 'Guardar',
  submittingLabel = 'Guardando…',
}: TrabajadorFormProps) {
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<TrabajadorFormValues>({
    resolver: zodResolver(trabajadorSchema),
    defaultValues: {
      tipo: 'turnos',
      ...defaultValues,
    },
  });

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1"
    >
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Nombre */}
        <View className="mb-4">
          <Controller
            control={control}
            name="nombre"
            render={({ field }) => (
              <Input
                label="Nombre *"
                error={errors.nombre?.message}
                value={field.value ?? ''}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                placeholder="Ej. Juan"
                autoCapitalize="words"
              />
            )}
          />
        </View>

        {/* Apellido */}
        <View className="mb-4">
          <Controller
            control={control}
            name="apellido"
            render={({ field }) => (
              <Input
                label="Apellido *"
                error={errors.apellido?.message}
                value={field.value ?? ''}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                placeholder="Ej. Pérez"
                autoCapitalize="words"
              />
            )}
          />
        </View>

        {/* Tipo (pill selector) */}
        <View className="mb-4">
          <Text className="text-sm font-semibold text-foreground mb-1">Tipo *</Text>
          <Controller
            control={control}
            name="tipo"
            render={({ field }) => (
              <View className="flex-row gap-2">
                {TIPO_OPTIONS.map(({ value, label }) => {
                  const active = field.value === value;
                  return (
                    <Pressable
                      key={value}
                      onPress={() => field.onChange(value)}
                      className={`flex-1 h-11 rounded-xl items-center justify-center border ${
                        active
                          ? 'bg-primary border-primary'
                          : 'bg-card border-border'
                      }`}
                    >
                      <Text
                        className={`text-sm font-semibold ${
                          active ? 'text-white' : 'text-muted-foreground'
                        }`}
                      >
                        {label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            )}
          />
          {errors.tipo && (
            <Text className="text-xs text-danger mt-1">{errors.tipo.message}</Text>
          )}
        </View>

        {/* Cédula */}
        <View className="mb-4">
          <Controller
            control={control}
            name="cedula"
            render={({ field }) => (
              <Input
                label="Cédula / Documento"
                error={errors.cedula?.message}
                value={field.value ?? ''}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                placeholder="Número de documento"
                keyboardType="numeric"
                autoCapitalize="none"
              />
            )}
          />
        </View>

        {/* Email */}
        <View className="mb-4">
          <Controller
            control={control}
            name="email"
            render={({ field }) => (
              <Input
                label="Correo electrónico"
                error={errors.email?.message}
                value={field.value ?? ''}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                placeholder="trabajador@empresa.com"
                keyboardType="email-address"
                autoCapitalize="none"
              />
            )}
          />
        </View>

        {/* Teléfono */}
        <View className="mb-4">
          <Controller
            control={control}
            name="telefono"
            render={({ field }) => (
              <Input
                label="Teléfono"
                error={errors.telefono?.message}
                value={field.value ?? ''}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                placeholder="+57 300 000 0000"
                keyboardType="phone-pad"
                autoCapitalize="none"
              />
            )}
          />
        </View>

        {/* Cargo */}
        <View className="mb-4">
          <Controller
            control={control}
            name="cargo"
            render={({ field }) => (
              <Input
                label="Cargo"
                error={errors.cargo?.message}
                value={field.value ?? ''}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                placeholder="Ej. Operario, Conductor…"
                autoCapitalize="sentences"
              />
            )}
          />
        </View>

        {/* Salario — divider */}
        <View className="mb-4 mt-1">
          <View className="flex-row items-center gap-3">
            <View className="flex-1 h-px bg-border" />
            <Text className="text-xs text-muted-foreground font-medium">SALARIO (opcional)</Text>
            <View className="flex-1 h-px bg-border" />
          </View>
          <Text className="text-xs text-muted-foreground mt-2 text-center">
            Solo uno es necesario. Tarifa/hora tiene prioridad sobre salario mensual.
          </Text>
        </View>

        {/* Tarifa hora */}
        <View className="mb-4">
          <Controller
            control={control}
            name="tarifa_hora"
            render={({ field }) => (
              <Input
                label="Tarifa por hora (COP)"
                error={errors.tarifa_hora?.message}
                value={field.value != null ? String(field.value) : ''}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                placeholder="Ej. 8500"
                keyboardType="numeric"
                autoCapitalize="none"
              />
            )}
          />
        </View>

        {/* Salario base */}
        <View className="mb-4">
          <Controller
            control={control}
            name="salario_base"
            render={({ field }) => (
              <Input
                label="Salario base mensual (COP)"
                error={errors.salario_base?.message}
                hint="Se divide entre 240 para obtener el valor/hora."
                value={field.value != null ? String(field.value) : ''}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                placeholder="Ej. 1300000"
                keyboardType="numeric"
                autoCapitalize="none"
              />
            )}
          />
        </View>

        {/* Submit */}
        <Pressable
          onPress={handleSubmit(onSubmit)}
          disabled={isSubmitting}
          className={`h-12 rounded-xl items-center justify-center mt-2 ${
            isSubmitting ? 'bg-primary/50' : 'bg-primary active:bg-primary/80'
          }`}
        >
          {isSubmitting ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="text-white font-bold text-base">{submitLabel}</Text>
          )}
        </Pressable>

        {/* Bottom padding for keyboard */}
        <View className="h-8" />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
