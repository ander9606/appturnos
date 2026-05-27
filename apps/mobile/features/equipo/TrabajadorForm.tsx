/**
 * TrabajadorForm — shared create/edit form.
 * Uses React Hook Form + Zod. Caller owns the submit handler.
 */
import React from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { trabajadorSchema, TIPO_OPTIONS, type TrabajadorFormValues } from './schemas';

// ── Sub-components ────────────────────────────────────────────────────────

interface FieldProps {
  label: string;
  error?: string;
  children: React.ReactNode;
  hint?: string;
}
function Field({ label, error, hint, children }: FieldProps) {
  return (
    <View className="mb-4">
      <Text className="text-sm font-semibold text-foreground mb-1">{label}</Text>
      {children}
      {hint && !error && (
        <Text className="text-xs text-muted-foreground mt-1">{hint}</Text>
      )}
      {error && (
        <Text className="text-xs text-danger mt-1">{error}</Text>
      )}
    </View>
  );
}

interface InputProps {
  value: string;
  onChangeText: (v: string) => void;
  onBlur: () => void;
  placeholder?: string;
  keyboardType?: 'default' | 'email-address' | 'numeric' | 'phone-pad';
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  hasError?: boolean;
}
function StyledInput({
  value, onChangeText, onBlur, placeholder,
  keyboardType = 'default', autoCapitalize = 'sentences', hasError,
}: InputProps) {
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      onBlur={onBlur}
      placeholder={placeholder}
      placeholderTextColor="#94A3B8"
      keyboardType={keyboardType}
      autoCapitalize={autoCapitalize}
      className={`bg-card border rounded-xl px-4 h-11 text-sm text-foreground ${
        hasError ? 'border-danger' : 'border-border'
      }`}
    />
  );
}

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
        <Field label="Nombre *" error={errors.nombre?.message}>
          <Controller
            control={control}
            name="nombre"
            render={({ field }) => (
              <StyledInput
                value={field.value ?? ''}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                placeholder="Ej. Juan"
                autoCapitalize="words"
                hasError={!!errors.nombre}
              />
            )}
          />
        </Field>

        {/* Apellido */}
        <Field label="Apellido *" error={errors.apellido?.message}>
          <Controller
            control={control}
            name="apellido"
            render={({ field }) => (
              <StyledInput
                value={field.value ?? ''}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                placeholder="Ej. Pérez"
                autoCapitalize="words"
                hasError={!!errors.apellido}
              />
            )}
          />
        </Field>

        {/* Tipo (pill selector) */}
        <Field label="Tipo *" error={errors.tipo?.message}>
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
        </Field>

        {/* Cédula */}
        <Field label="Cédula / Documento" error={errors.cedula?.message}>
          <Controller
            control={control}
            name="cedula"
            render={({ field }) => (
              <StyledInput
                value={field.value ?? ''}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                placeholder="Número de documento"
                keyboardType="numeric"
                autoCapitalize="none"
                hasError={!!errors.cedula}
              />
            )}
          />
        </Field>

        {/* Email */}
        <Field label="Correo electrónico" error={errors.email?.message}>
          <Controller
            control={control}
            name="email"
            render={({ field }) => (
              <StyledInput
                value={field.value ?? ''}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                placeholder="trabajador@empresa.com"
                keyboardType="email-address"
                autoCapitalize="none"
                hasError={!!errors.email}
              />
            )}
          />
        </Field>

        {/* Teléfono */}
        <Field label="Teléfono" error={errors.telefono?.message}>
          <Controller
            control={control}
            name="telefono"
            render={({ field }) => (
              <StyledInput
                value={field.value ?? ''}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                placeholder="+57 300 000 0000"
                keyboardType="phone-pad"
                autoCapitalize="none"
                hasError={!!errors.telefono}
              />
            )}
          />
        </Field>

        {/* Cargo */}
        <Field label="Cargo" error={errors.cargo?.message}>
          <Controller
            control={control}
            name="cargo"
            render={({ field }) => (
              <StyledInput
                value={field.value ?? ''}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                placeholder="Ej. Operario, Conductor…"
                autoCapitalize="sentences"
                hasError={!!errors.cargo}
              />
            )}
          />
        </Field>

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
        <Field
          label="Tarifa por hora (COP)"
          error={errors.tarifa_hora?.message}
        >
          <Controller
            control={control}
            name="tarifa_hora"
            render={({ field }) => (
              <StyledInput
                value={field.value != null ? String(field.value) : ''}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                placeholder="Ej. 8500"
                keyboardType="numeric"
                autoCapitalize="none"
                hasError={!!errors.tarifa_hora}
              />
            )}
          />
        </Field>

        {/* Salario base */}
        <Field
          label="Salario base mensual (COP)"
          error={errors.salario_base?.message}
          hint="Se divide entre 240 para obtener el valor/hora."
        >
          <Controller
            control={control}
            name="salario_base"
            render={({ field }) => (
              <StyledInput
                value={field.value != null ? String(field.value) : ''}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                placeholder="Ej. 1300000"
                keyboardType="numeric"
                autoCapitalize="none"
                hasError={!!errors.salario_base}
              />
            )}
          />
        </Field>

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
