/**
 * Pantalla: Recuperar contraseña
 *
 * Flujo de 2 pasos:
 *   Paso 1 — email → envía OTP
 *   Paso 2 — código OTP + nueva contraseña → restablece y vuelve a login
 */
import React from 'react';
import {
  View,
  Text,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';

import {
  recuperarEmailSchema,
  recuperarPasswordSchema,
  type RecuperarEmailFormData,
  type RecuperarPasswordFormData,
} from '@/features/auth/schemas';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { authApi } from '@api-client';
import type { ApiError } from '@api-client';

export default function RecuperarScreen() {
  const router = useRouter();

  const [step, setStep] = React.useState<'email' | 'reset'>('email');
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [resending, setResending] = React.useState(false);

  const emailRef = React.useRef('');

  // ── Paso 1: email ────────────────────────────────────────────────────────
  const form1 = useForm<RecuperarEmailFormData>({
    resolver: zodResolver(recuperarEmailSchema),
    defaultValues: { email: '' },
  });

  const onSubmitEmail = async (data: RecuperarEmailFormData) => {
    setServerError(null);
    try {
      await authApi.enviarOtp({ tipo: 'email', destino: data.email });
      emailRef.current = data.email;
      setStep('reset');
    } catch (err) {
      setServerError((err as ApiError)?.message ?? 'No se pudo enviar el código. Intenta de nuevo.');
    }
  };

  // ── Paso 2: código + nueva contraseña ───────────────────────────────────
  const form2 = useForm<RecuperarPasswordFormData>({
    resolver: zodResolver(recuperarPasswordSchema),
    defaultValues: { codigo: '', password: '', confirmPassword: '' },
  });

  const onSubmitReset = async (data: RecuperarPasswordFormData) => {
    setServerError(null);
    try {
      const { token } = await authApi.verificarOtp({
        tipo: 'email',
        destino: emailRef.current,
        codigo: data.codigo,
      });
      await authApi.resetPassword({
        email: emailRef.current,
        password: data.password,
        email_token: token,
      });
      Alert.alert('Listo', 'Tu contraseña fue actualizada. Inicia sesión con la nueva.', [
        { text: 'OK', onPress: () => router.replace('/(auth)/login') },
      ]);
    } catch (err) {
      setServerError((err as ApiError)?.message ?? 'No se pudo restablecer la contraseña. Intenta de nuevo.');
    }
  };

  const reenviarCodigo = async () => {
    setResending(true);
    try {
      await authApi.enviarOtp({ tipo: 'email', destino: emailRef.current });
    } finally {
      setResending(false);
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
            <Ionicons name="key-outline" size={40} color="white" />
          </View>
          <Text className="text-2xl font-bold text-white">Recuperar contraseña</Text>
          <Text className="text-sm text-white/80 mt-1 px-8 text-center">
            {step === 'email'
              ? 'Ingresa tu correo para enviarte un código'
              : `Ingresa el código enviado a ${emailRef.current}`}
          </Text>
        </View>

        <View className="flex-1 px-6 pt-8 pb-6 gap-5">
          {serverError && (
            <View className="bg-danger-light border border-danger/30 rounded-xl px-4 py-3">
              <Text className="text-sm font-medium text-danger">{serverError}</Text>
            </View>
          )}

          {step === 'email' && (
            <View className="gap-4">
              <Controller
                control={form1.control}
                name="email"
                render={({ field: { onChange, onBlur, value } }) => (
                  <Input
                    label="Correo electrónico"
                    placeholder="tu@correo.com"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="email"
                    returnKeyType="done"
                    onSubmitEditing={form1.handleSubmit(onSubmitEmail)}
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    error={form1.formState.errors.email?.message}
                  />
                )}
              />

              <Button
                label={form1.formState.isSubmitting ? 'Enviando…' : 'Enviar código'}
                onPress={form1.handleSubmit(onSubmitEmail)}
                loading={form1.formState.isSubmitting}
                fullWidth
                size="lg"
              />
            </View>
          )}

          {step === 'reset' && (
            <View className="gap-4">
              <Controller
                control={form2.control}
                name="codigo"
                render={({ field: { onChange, onBlur, value } }) => (
                  <Input
                    label="Código de verificación"
                    placeholder="000000"
                    keyboardType="number-pad"
                    maxLength={6}
                    returnKeyType="next"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    error={form2.formState.errors.codigo?.message}
                  />
                )}
              />

              <Controller
                control={form2.control}
                name="password"
                render={({ field: { onChange, onBlur, value } }) => (
                  <Input
                    label="Nueva contraseña"
                    placeholder="Mínimo 8 caracteres"
                    isPassword
                    returnKeyType="next"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    error={form2.formState.errors.password?.message}
                    hint="Mínimo 8 caracteres"
                  />
                )}
              />

              <Controller
                control={form2.control}
                name="confirmPassword"
                render={({ field: { onChange, onBlur, value } }) => (
                  <Input
                    label="Confirmar contraseña"
                    placeholder="Repite la contraseña"
                    isPassword
                    returnKeyType="done"
                    onSubmitEditing={form2.handleSubmit(onSubmitReset)}
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    error={form2.formState.errors.confirmPassword?.message}
                  />
                )}
              />

              <Button
                label={form2.formState.isSubmitting ? 'Restableciendo…' : 'Restablecer contraseña'}
                onPress={form2.handleSubmit(onSubmitReset)}
                loading={form2.formState.isSubmitting}
                fullWidth
                size="lg"
              />

              <TouchableOpacity onPress={reenviarCodigo} disabled={resending} className="items-center py-1">
                <Text className="text-xs text-primary-500 font-medium">
                  {resending ? 'Reenviando…' : 'Reenviar código'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={() => setStep('email')} className="items-center py-2">
                <Text className="text-sm text-muted-foreground">← Cambiar correo</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
