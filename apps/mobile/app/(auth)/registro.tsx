/**
 * Pantalla: Registro libre (marketplace)
 *
 * Flujo:
 *   1. Trabajador completa nombre, email y contraseña
 *   2. Se llama useAuthStore.registrar()
 *   3. Si OK → autenticado, _layout.tsx redirige a (tabs)
 *   4. Si error → mensaje en pantalla
 */
import React from 'react';
import {
  View,
  Text,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { Link } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';

import { registroSchema, type RegistroFormData } from '@/features/auth/schemas';
import { useAuthStore } from '@/features/auth/useAuthStore';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import type { ApiError } from '@api-client';

export default function RegistroScreen() {
  const registrar = useAuthStore((s) => s.registrar);
  const [serverError, setServerError] = React.useState<string | null>(null);

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegistroFormData>({
    resolver: zodResolver(registroSchema),
    defaultValues: { nombre: '', apellido: '', email: '', password: '', confirmPassword: '' },
  });

  const onSubmit = async (data: RegistroFormData) => {
    setServerError(null);
    try {
      await registrar({
        nombre:   data.nombre,
        apellido: data.apellido,
        email:    data.email,
        password: data.password,
      });
    } catch (err) {
      const e = err as ApiError;
      if (e?.status === 409) setServerError('El correo ya está registrado.');
      else setServerError(e?.message ?? 'Ocurrió un error. Intenta de nuevo.');
    }
  };

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-background"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar style="light" />
      <ScrollView
        contentContainerClassName="flex-grow"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View className="items-center justify-end bg-primary-600 pt-16 pb-10 rounded-b-[40px]">
          <View className="w-20 h-20 rounded-2xl bg-white/20 items-center justify-center mb-4">
            <Ionicons name="person-add-outline" size={40} color="white" />
          </View>
          <Text className="text-2xl font-bold text-white">Crear cuenta</Text>
          <Text className="text-sm text-white/80 mt-1 px-8 text-center">
            Regístrate para aplicar a turnos en empresas del directorio
          </Text>
        </View>

        {/* Form */}
        <View className="flex-1 px-6 pt-8 pb-6 gap-5">
          {serverError && (
            <View className="bg-danger-light border border-danger/30 rounded-xl px-4 py-3">
              <Text className="text-sm font-medium text-danger">{serverError}</Text>
            </View>
          )}

          <View className="gap-4">
            {/* Nombre + Apellido */}
            <View className="flex-row gap-3">
              <View className="flex-1">
                <Controller
                  control={control}
                  name="nombre"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <Input
                      label="Nombre *"
                      placeholder="Juan"
                      autoCapitalize="words"
                      returnKeyType="next"
                      value={value}
                      onChangeText={onChange}
                      onBlur={onBlur}
                      error={errors.nombre?.message}
                    />
                  )}
                />
              </View>
              <View className="flex-1">
                <Controller
                  control={control}
                  name="apellido"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <Input
                      label="Apellido"
                      placeholder="Pérez"
                      autoCapitalize="words"
                      returnKeyType="next"
                      value={value ?? ''}
                      onChangeText={onChange}
                      onBlur={onBlur}
                      error={errors.apellido?.message}
                    />
                  )}
                />
              </View>
            </View>

            {/* Email */}
            <Controller
              control={control}
              name="email"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  label="Correo electrónico *"
                  placeholder="tu@correo.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="email"
                  returnKeyType="next"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={errors.email?.message}
                />
              )}
            />

            {/* Password */}
            <Controller
              control={control}
              name="password"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  label="Contraseña *"
                  placeholder="Mínimo 8 caracteres"
                  isPassword
                  returnKeyType="next"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={errors.password?.message}
                  hint="Mínimo 8 caracteres"
                />
              )}
            />

            {/* Confirm */}
            <Controller
              control={control}
              name="confirmPassword"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  label="Confirmar contraseña *"
                  placeholder="Repite la contraseña"
                  isPassword
                  returnKeyType="done"
                  onSubmitEditing={handleSubmit(onSubmit)}
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={errors.confirmPassword?.message}
                />
              )}
            />
          </View>

          <Button
            label={isSubmitting ? 'Creando cuenta…' : 'Crear cuenta'}
            onPress={handleSubmit(onSubmit)}
            loading={isSubmitting}
            fullWidth
            size="lg"
          />

          <View className="items-center gap-2 mt-1">
            <View className="flex-row gap-1">
              <Text className="text-sm text-muted-foreground">¿Ya tienes cuenta?</Text>
              <Link href="/(auth)/login" asChild>
                <TouchableOpacity>
                  <Text className="text-sm font-semibold text-primary-500">Inicia sesión</Text>
                </TouchableOpacity>
              </Link>
            </View>
            <View className="flex-row gap-1">
              <Text className="text-sm text-muted-foreground">¿Te invitó una empresa?</Text>
              <Link href="/(auth)/activar" asChild>
                <TouchableOpacity>
                  <Text className="text-sm font-semibold text-primary-500">Activa tu cuenta</Text>
                </TouchableOpacity>
              </Link>
            </View>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
