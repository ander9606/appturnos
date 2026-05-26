/**
 * Pantalla: Activar cuenta
 *
 * Flujo:
 *   1. Trabajador introduce cédula + email + contraseña
 *   2. Se llama useAuthStore.activarCuenta()
 *      (internamente: POST /api/auth/activar-cuenta → POST /api/auth/login)
 *   3. Si OK → queda autenticado, _layout.tsx redirige a (tabs)
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

import { activarCuentaSchema, type ActivarCuentaFormData } from '@/features/auth/schemas';
import { useAuthStore } from '@/features/auth/useAuthStore';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { t } from '@/lib/i18n';
import { ApiError } from '@api-client';

export default function ActivarCuentaScreen() {
  const activarCuenta = useAuthStore((s) => s.activarCuenta);
  const [serverError, setServerError] = React.useState<string | null>(null);

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ActivarCuentaFormData>({
    resolver: zodResolver(activarCuentaSchema),
    defaultValues: { cedula: '', email: '', password: '', confirmPassword: '' },
  });

  const onSubmit = async (data: ActivarCuentaFormData) => {
    setServerError(null);
    try {
      await activarCuenta({
        cedula: data.cedula,
        email: data.email,
        password: data.password,
      });
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 404) setServerError(t('auth.errors.cedulaNotFound'));
        else if (err.status === 409 && err.message.includes('email'))
          setServerError(t('auth.errors.emailInUse'));
        else if (err.status === 409)
          setServerError(t('auth.errors.alreadyActivated'));
        else if (err.status === 401)
          setServerError(t('auth.errors.invalidCredentials'));
        else setServerError(err.message);
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
        {/* ── Header ───────────────────────────────────────────────────── */}
        <View className="items-center justify-end bg-primary-600 pt-16 pb-10 rounded-b-[40px]">
          <View className="w-20 h-20 rounded-2xl bg-white/20 items-center justify-center mb-4">
            <Text className="text-4xl">🔑</Text>
          </View>
          <Text className="text-2xl font-bold text-white">{t('auth.activar.title')}</Text>
          <Text className="text-sm text-white/80 mt-1 px-8 text-center">
            {t('auth.activar.subtitle')}
          </Text>
        </View>

        {/* ── Form ─────────────────────────────────────────────────────── */}
        <View className="flex-1 px-6 pt-8 pb-6 gap-5">
          {/* Server error banner */}
          {serverError && (
            <View className="bg-danger-light border border-danger/30 rounded-xl px-4 py-3">
              <Text className="text-sm font-medium text-danger">{serverError}</Text>
            </View>
          )}

          <View className="gap-4">
            {/* Cédula */}
            <Controller
              control={control}
              name="cedula"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  label={t('auth.activar.cedula')}
                  placeholder={t('auth.activar.cedulaPlaceholder')}
                  keyboardType="number-pad"
                  returnKeyType="next"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={errors.cedula?.message}
                />
              )}
            />

            {/* Email */}
            <Controller
              control={control}
              name="email"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  label={t('auth.activar.email')}
                  placeholder={t('auth.activar.emailPlaceholder')}
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
                  label={t('auth.activar.password')}
                  placeholder={t('auth.activar.passwordPlaceholder')}
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

            {/* Confirm password */}
            <Controller
              control={control}
              name="confirmPassword"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  label={t('auth.activar.confirmPassword')}
                  placeholder={t('auth.activar.confirmPlaceholder')}
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

          {/* Submit */}
          <Button
            label={isSubmitting ? t('auth.activar.submitting') : t('auth.activar.submit')}
            onPress={handleSubmit(onSubmit)}
            loading={isSubmitting}
            fullWidth
            size="lg"
          />

          {/* Footer link → Login */}
          <View className="flex-row justify-center gap-1 mt-2">
            <Text className="text-sm text-muted-foreground">
              {t('auth.activar.alreadyAccount')}
            </Text>
            <Link href="/(auth)/login" asChild>
              <TouchableOpacity>
                <Text className="text-sm font-semibold text-primary-500">
                  {t('auth.activar.loginLink')}
                </Text>
              </TouchableOpacity>
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
