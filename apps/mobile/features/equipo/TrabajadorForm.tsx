/**
 * TrabajadorForm — shared create/edit form.
 * Uses React Hook Form + Zod. Caller owns the submit handler.
 */
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  FlatList,
  Modal,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Ionicons } from '@expo/vector-icons';
import { trabajadorSchema, TIPO_OPTIONS, TIPO_HINTS, type TrabajadorFormValues } from './schemas';
import { Input } from '@/components/ui/Input';
import { useCargos } from '@/features/turnos/useTurnos';

// ── Pill selector — reutilizado para tipo_documento / sexo / tipo_cuenta ────

function PillSelector<T extends string>({
  label, options, labels, value, onChange,
}: {
  label: string;
  options: readonly T[];
  labels: Record<T, string>;
  value: T | '' | undefined;
  onChange: (v: T) => void;
}) {
  return (
    <View className="mb-4">
      <Text className="text-sm font-semibold text-foreground mb-1">{label}</Text>
      <View className="flex-row gap-2">
        {options.map((opt) => {
          const active = value === opt;
          return (
            <Pressable
              key={opt}
              onPress={() => onChange(opt)}
              className={`flex-1 h-11 rounded-xl items-center justify-center border ${
                active ? 'bg-primary border-primary' : 'bg-card border-border'
              }`}
            >
              <Text className={`text-sm font-semibold ${active ? 'text-white' : 'text-muted-foreground'}`}>
                {labels[opt]}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────

interface TrabajadorFormProps {
  defaultValues?: Partial<TrabajadorFormValues>;
  onSubmit: (data: TrabajadorFormValues) => Promise<void>;
  submitLabel?: string;
  submittingLabel?: string;
  /** Avisa al padre si el formulario tiene cambios sin guardar (para confirmar antes de descartar). */
  onDirtyChange?: (dirty: boolean) => void;
}

// ── Component ─────────────────────────────────────────────────────────────

export function TrabajadorForm({
  defaultValues,
  onSubmit,
  submitLabel = 'Guardar',
  submittingLabel = 'Guardando…',
  onDirtyChange,
}: TrabajadorFormProps) {
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<TrabajadorFormValues>({
    resolver: zodResolver(trabajadorSchema),
    defaultValues: {
      tipo: 'turnos',
      ...defaultValues,
    },
  });

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  const tipo = useWatch({ control, name: 'tipo' });
  const muestraSalario = tipo !== 'turnos'; // turnos cobra por oferta_puestos.tarifa_dia, no por salario fijo
  // turnos ya tiene "Cargos certificados" (trabajador_cargos) en la ficha del
  // trabajador — mostrar acá también este picker era redundante.
  const muestraCargo = tipo !== 'turnos';

  const { data: cargos = [] } = useCargos();
  const cargosActivos = cargos.filter((c) => c.activo);
  const [cargoModalVisible, setCargoModalVisible] = useState(false);

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
              <>
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
                {field.value && (
                  <Text className="text-xs text-muted-foreground mt-1.5">
                    {TIPO_HINTS[field.value]}
                  </Text>
                )}
              </>
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

        {/* Tipo de documento + fecha de nacimiento + sexo */}
        <Controller
          control={control}
          name="tipo_documento"
          render={({ field }) => (
            <PillSelector
              label="Tipo de documento"
              options={['CC', 'CE', 'PAS'] as const}
              labels={{ CC: 'Cédula (CC)', CE: 'Cédula Ext. (CE)', PAS: 'Pasaporte' }}
              value={field.value}
              onChange={field.onChange}
            />
          )}
        />

        <View className="mb-4">
          <Controller
            control={control}
            name="fecha_nacimiento"
            render={({ field }) => (
              <Input
                label="Fecha de nacimiento (AAAA-MM-DD)"
                error={errors.fecha_nacimiento?.message}
                value={field.value ?? ''}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                placeholder="1990-01-15"
              />
            )}
          />
        </View>

        <Controller
          control={control}
          name="sexo"
          render={({ field }) => (
            <PillSelector
              label="Sexo"
              options={['M', 'F', 'otro'] as const}
              labels={{ M: 'Masculino', F: 'Femenino', otro: 'Otro' }}
              value={field.value}
              onChange={field.onChange}
            />
          )}
        />

        {/* Contacto de emergencia */}
        <View className="mb-4">
          <Controller
            control={control}
            name="contacto_emergencia_nombre"
            render={({ field }) => (
              <Input
                label="Contacto de emergencia — nombre"
                error={errors.contacto_emergencia_nombre?.message}
                value={field.value ?? ''}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                placeholder="Nombre completo"
                autoCapitalize="words"
              />
            )}
          />
        </View>

        <View className="mb-4">
          <Controller
            control={control}
            name="contacto_emergencia_tel"
            render={({ field }) => (
              <Input
                label="Contacto de emergencia — teléfono"
                error={errors.contacto_emergencia_tel?.message}
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

        {/* Cargo — select sobre el catálogo de la empresa; oculto en turnos, que
            ya gestiona esto vía "Cargos certificados" en la ficha del trabajador */}
        {muestraCargo && (
        <View className="mb-4">
          <Text className="text-sm font-semibold text-foreground mb-1">Cargo</Text>
          <Controller
            control={control}
            name="cargo"
            render={({ field }) => (
              <>
                <Pressable
                  onPress={() => setCargoModalVisible(true)}
                  className="bg-card border border-border rounded-2xl px-4 h-14 flex-row items-center justify-between active:opacity-70"
                >
                  <Text className={`text-base flex-1 ${field.value ? 'text-foreground' : 'text-muted-foreground'}`}>
                    {field.value || 'Seleccionar cargo…'}
                  </Text>
                  <Ionicons name="chevron-forward" size={16} color="#94A3B8" />
                </Pressable>

                <Modal
                  visible={cargoModalVisible}
                  animationType="slide"
                  presentationStyle="pageSheet"
                  onRequestClose={() => setCargoModalVisible(false)}
                >
                  <View className="flex-1 bg-background">
                    <View className="flex-row items-center justify-between px-5 py-4 border-b border-border">
                      <Text className="text-base font-bold text-foreground">Seleccionar cargo</Text>
                      <Pressable onPress={() => setCargoModalVisible(false)} hitSlop={8}>
                        <Ionicons name="close" size={24} color="#64748B" />
                      </Pressable>
                    </View>

                    <Pressable
                      onPress={() => {
                        field.onChange('');
                        setCargoModalVisible(false);
                      }}
                      className="flex-row items-center gap-3 px-5 py-4 border-b border-border active:opacity-70"
                    >
                      <View className="w-8 h-8 rounded-full bg-muted items-center justify-center">
                        <Ionicons name="close" size={14} color="#64748B" />
                      </View>
                      <Text className="text-sm text-muted-foreground flex-1">Sin cargo asignado</Text>
                      {!field.value && <Ionicons name="checkmark" size={18} color="#6366F1" />}
                    </Pressable>

                    <FlatList
                      data={cargosActivos}
                      keyExtractor={(c) => String(c.id)}
                      renderItem={({ item }) => {
                        const selected = field.value === item.nombre;
                        return (
                          <Pressable
                            onPress={() => {
                              field.onChange(item.nombre);
                              setCargoModalVisible(false);
                            }}
                            className="flex-row items-center gap-3 px-5 py-4 border-b border-border active:opacity-70"
                          >
                            <View className="w-8 h-8 rounded-full bg-info/10 items-center justify-center">
                              <Ionicons name="briefcase-outline" size={14} color="#3B82F6" />
                            </View>
                            <Text className="text-sm font-medium text-foreground flex-1">{item.nombre}</Text>
                            {selected && <Ionicons name="checkmark" size={18} color="#6366F1" />}
                          </Pressable>
                        );
                      }}
                      ListEmptyComponent={
                        <View className="p-8 items-center gap-2">
                          <Ionicons name="briefcase-outline" size={32} color="#94A3B8" />
                          <Text className="text-sm text-muted-foreground text-center">
                            No hay cargos creados todavía.{'\n'}Creá uno primero en "Gestión de cargos".
                          </Text>
                        </View>
                      }
                    />
                  </View>
                </Modal>
              </>
            )}
          />
          {errors.cargo && (
            <Text className="text-xs text-danger mt-1">{errors.cargo.message}</Text>
          )}
        </View>
        )}

        {/* Salario — solo aplica a nómina/ambos; turnos cobra por tarifa del puesto */}
        {muestraSalario && (
          <>
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

            {/* Seguridad social y datos bancarios */}
            <View className="mb-4 mt-1">
              <View className="flex-row items-center gap-3">
                <View className="flex-1 h-px bg-border" />
                <Text className="text-xs text-muted-foreground font-medium">SEGURIDAD SOCIAL Y BANCO (opcional)</Text>
                <View className="flex-1 h-px bg-border" />
              </View>
            </View>

            <View className="mb-4">
              <Controller
                control={control}
                name="eps"
                render={({ field }) => (
                  <Input
                    label="EPS"
                    error={errors.eps?.message}
                    value={field.value ?? ''}
                    onChangeText={field.onChange}
                    onBlur={field.onBlur}
                    placeholder="Ej. Sura"
                    autoCapitalize="words"
                  />
                )}
              />
            </View>

            <View className="mb-4">
              <Controller
                control={control}
                name="afp"
                render={({ field }) => (
                  <Input
                    label="AFP"
                    error={errors.afp?.message}
                    value={field.value ?? ''}
                    onChangeText={field.onChange}
                    onBlur={field.onBlur}
                    placeholder="Ej. Porvenir"
                    autoCapitalize="words"
                  />
                )}
              />
            </View>

            <View className="mb-4">
              <Controller
                control={control}
                name="banco"
                render={({ field }) => (
                  <Input
                    label="Banco"
                    error={errors.banco?.message}
                    value={field.value ?? ''}
                    onChangeText={field.onChange}
                    onBlur={field.onBlur}
                    placeholder="Ej. Bancolombia"
                    autoCapitalize="words"
                  />
                )}
              />
            </View>

            <Controller
              control={control}
              name="tipo_cuenta"
              render={({ field }) => (
                <PillSelector
                  label="Tipo de cuenta"
                  options={['ahorros', 'corriente'] as const}
                  labels={{ ahorros: 'Ahorros', corriente: 'Corriente' }}
                  value={field.value}
                  onChange={field.onChange}
                />
              )}
            />

            <View className="mb-4">
              <Controller
                control={control}
                name="numero_cuenta"
                render={({ field }) => (
                  <Input
                    label="Número de cuenta"
                    error={errors.numero_cuenta?.message}
                    value={field.value ?? ''}
                    onChangeText={field.onChange}
                    onBlur={field.onBlur}
                    placeholder="Número de cuenta"
                    keyboardType="numeric"
                    autoCapitalize="none"
                  />
                )}
              />
            </View>

            {/* Antecedentes */}
            <View className="mb-4 mt-1">
              <View className="flex-row items-center gap-3">
                <View className="flex-1 h-px bg-border" />
                <Text className="text-xs text-muted-foreground font-medium">ANTECEDENTES (opcional)</Text>
                <View className="flex-1 h-px bg-border" />
              </View>
            </View>

            <View className="mb-4">
              <Controller
                control={control}
                name="ant_judiciales_fecha"
                render={({ field }) => (
                  <Input
                    label="Antecedentes judiciales — fecha (AAAA-MM-DD)"
                    error={errors.ant_judiciales_fecha?.message}
                    value={field.value ?? ''}
                    onChangeText={field.onChange}
                    onBlur={field.onBlur}
                    placeholder="2025-01-15"
                  />
                )}
              />
            </View>

            <View className="mb-4">
              <Controller
                control={control}
                name="ant_disciplinarios_fecha"
                render={({ field }) => (
                  <Input
                    label="Antecedentes disciplinarios — fecha (AAAA-MM-DD)"
                    error={errors.ant_disciplinarios_fecha?.message}
                    value={field.value ?? ''}
                    onChangeText={field.onChange}
                    onBlur={field.onBlur}
                    placeholder="2025-01-15"
                  />
                )}
              />
            </View>
          </>
        )}

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
