/**
 * Pantalla: Login
 *
 * Flujo:
 *   1. Usuario introduce email + contraseña
 *   2. Se llama useAuthStore.login()
 *   3. Si OK → Expo Router redirige automáticamente a (tabs) via _layout.tsx
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
  Image,
} from 'react-native';
import { Link } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { StatusBar } from 'expo-status-bar';

import { loginSchema, type LoginFormData } from '@/features/auth/schemas';
import { useAuthStore } from '@/features/auth/useAuthStore';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { t } from '@/lib/i18n';
import { ApiError } from '@api-client';

export default function LoginScreen() {
  const login = useAuthStore((s) => s.login);
  const [serverError, setServerError] = React.useState<string | null>(null);

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = async (data: LoginFormData) => {
    setServerError(null);
    try {
      await login(data.email, data.password);
      // Navigation handled automatically by _layout.tsx on status change
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 401) setServerError(t('auth.errors.invalidCredentials'));
        else if (err.status === 429) setServerError(t('auth.errors.accountLocked'));
        else if (err.status === 403) setServerError(t('auth.errors.inactiveUser'));
        else setServerError(err.message);
      } else if (err instanceof TypeError) {
        setServerError('No se pudo conectar al servidor. Verifica que el backend esté activo y que EXPO_PUBLIC_API_URL tenga la IP correcta.');
      } else {
        setServerError(t('auth.errors.generic'));
      }
    }
  };

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-background"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar style="dark" />
      <ScrollView
        contentContainerClassName="flex-grow"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header illustration ──────────────────────────────────────── */}
        <View className="items-center justify-end bg-primary-500 pt-16 pb-10 rounded-b-[40px]">
          {/* Logo placeholder — replace with <Image> when asset is ready */}
          <View className="w-20 h-20 rounded-2xl bg-white/20 items-center justify-center mb-4">
            <Text className="text-4xl">📅</Text>
          </View>
          <Text className="text-2xl font-bold text-white">AppTurnos</Text>
          <Text className="text-sm text-white/80 mt-1">Gestión de turnos y nómina</Text>
        </View>

        {/* ── Form ─────────────────────────────────────────────────────── */}
        <View className="flex-1 px-6 pt-8 pb-6 gap-5">
          <View className="gap-1">
            <Text className="text-2xl font-bold text-foreground">
              {t('auth.login.title')} 👋
            </Text>
            <Text className="text-base text-muted-foreground">
              {t('auth.login.subtitle')}
            </Text>
          </View>

          {/* Server error banner */}
          {serverError && (
            <View className="bg-danger-light border border-danger/30 rounded-xl px-4 py-3">
              <Text className="text-sm font-medium text-danger">{serverError}</Text>
            </View>
          )}

          <View className="gap-4">
            {/* Email */}
            <Controller
              control={control}
              name="email"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  label={t('auth.login.email')}
                  placeholder={t('auth.login.emailPlaceholder')}
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
                  label={t('auth.login.password')}
                  placeholder={t('auth.login.passwordPlaceholder')}
                  isPassword
                  autoComplete="password"
                  returnKeyType="done"
                  onSubmitEditing={handleSubmit(onSubmit)}
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={errors.password?.message}
                />
              )}
            />
          </View>

          {/* Forgot password (future) */}
          <TouchableOpacity className="self-end">
            <Text className="text-sm text-primary-500 font-medium">
              {t('auth.login.forgotPassword')}
            </Text>
          </TouchableOpacity>

          {/* Submit */}
          <Button
            label={isSubmitting ? t('auth.login.submitting') : t('auth.login.submit')}
            onPress={handleSubmit(onSubmit)}
            loading={isSubmitting}
            fullWidth
            size="lg"
          />

          {/* Footer link → Activar cuenta */}
          <View className="flex-row justify-center gap-1 mt-2">
            <Text className="text-sm text-muted-foreground">
              {t('auth.login.noAccount')}
            </Text>
            <Link href="/(auth)/activar" asChild>
              <TouchableOpacity>
                <Text className="text-sm font-semibold text-primary-500">
                  {t('auth.login.activateLink')}
                </Text>
              </TouchableOpacity>
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
