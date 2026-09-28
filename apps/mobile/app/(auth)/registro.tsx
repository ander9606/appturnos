/**
 * Pantalla: Registro libre (marketplace)
 *
 * Flujo de 2 pasos:
 *   Paso 1 — datos personales (nombre, email, teléfono, contraseña)
 *             → envía OTP a email y teléfono simultáneamente
 *   Paso 2 — verificación de los dos códigos OTP
 *             → al confirmar ambos, crea la cuenta y autentica
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

import {
  registroSchema,
  otpSchema,
  type RegistroFormData,
  type OtpFormData,
} from '@/features/auth/schemas';
import { useAuthStore } from '@/features/auth/useAuthStore';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { authApi } from '@api-client';
import type { ApiError } from '@api-client';

export default function RegistroScreen() {
  const registrar = useAuthStore((s) => s.registrar);

  // step: 'datos' | 'otp'
  const [step, setStep] = React.useState<'datos' | 'otp'>('datos');
  const [serverError, setServerError] = React.useState<string | null>(null);

  // token devuelto por verificar-otp
  const emailTokenRef = React.useRef<string | null>(null);

  // saved form values to pass to step 2
  const formDataRef = React.useRef<RegistroFormData | null>(null);

  // ── Paso 1: datos ────────────────────────────────────────────────────────
  const form1 = useForm<RegistroFormData>({
    resolver: zodResolver(registroSchema),
    defaultValues: { nombre: '', apellido: '', email: '', telefono: '', password: '', confirmPassword: '' },
  });

  const onSubmitDatos = async (data: RegistroFormData) => {
    setServerError(null);
    try {
      await authApi.enviarOtp({ tipo: 'email', destino: data.email });
      formDataRef.current = data;
      setStep('otp');
    } catch (err) {
      const e = err as ApiError;
      setServerError(e?.message ?? 'No se pudo enviar el código. Intenta de nuevo.');
    }
  };

  // ── Paso 2: OTP ──────────────────────────────────────────────────────────
  const form2 = useForm<{ emailOtp: OtpFormData }>({
    defaultValues: { emailOtp: { codigo: '' } },
  });

  // Individual field errors handled via state for simplicity
  const [otpEmailError,  setOtpEmailError]  = React.useState<string | null>(null);
  const [emailVerified,  setEmailVerified]  = React.useState(false);
  const [isVerifying,    setIsVerifying]    = React.useState(false);
  const [isCreating,     setIsCreating]     = React.useState(false);
  const [resendingEmail, setResendingEmail] = React.useState(false);

  const [emailOtp, setEmailOtp] = React.useState('');

  const data = formDataRef.current!;

  const crearCuenta = async () => {
    if (!emailVerified || !emailTokenRef.current) {
      setServerError('Verifica el código antes de continuar.');
      return;
    }
    setServerError(null);
    setIsCreating(true);
    try {
      await registrar({
        nombre:      data.nombre,
        apellido:    data.apellido,
        email:       data.email,
        telefono:    data.telefono,
        password:    data.password,
        email_token: emailTokenRef.current,
      });
    } catch (err) {
      const e = err as ApiError;
      if (e?.status === 409) setServerError('El correo ya está registrado.');
      else setServerError(e?.message ?? 'Ocurrió un error. Intenta de nuevo.');
    } finally {
      setIsCreating(false);
    }
  };

  const verificarEmail = async () => {
    if (emailOtp.length !== 6) { setOtpEmailError('El código tiene 6 dígitos'); return; }
    setOtpEmailError(null);
    setIsVerifying(true);
    try {
      const { token } = await authApi.verificarOtp({ tipo: 'email', destino: data.email, codigo: emailOtp });
      emailTokenRef.current = token;
      setEmailVerified(true);
    } catch (err) {
      setOtpEmailError((err as ApiError)?.message ?? 'Código incorrecto');
    } finally {
      setIsVerifying(false);
    }
  };

  const reenviarEmail = async () => {
    setResendingEmail(true);
    try { await authApi.enviarOtp({ tipo: 'email', destino: data.email }); }
    finally { setResendingEmail(false); }
  };

  // ── Render ───────────────────────────────────────────────────────────────
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
            <Ionicons
              name={step === 'datos' ? 'person-add-outline' : 'shield-checkmark-outline'}
              size={40}
              color="white"
            />
          </View>
          <Text className="text-2xl font-bold text-white">
            {step === 'datos' ? 'Crear cuenta' : 'Verificar identidad'}
          </Text>
          <Text className="text-sm text-white/80 mt-1 px-8 text-center">
            {step === 'datos'
              ? 'Regístrate para aplicar a turnos en empresas del directorio'
              : 'Ingresa el código que enviamos a tu correo'}
          </Text>
          {/* Step dots */}
          <View className="flex-row gap-2 mt-4">
            <View className={`w-2 h-2 rounded-full ${step === 'datos' ? 'bg-white' : 'bg-white/40'}`} />
            <View className={`w-2 h-2 rounded-full ${step === 'otp'   ? 'bg-white' : 'bg-white/40'}`} />
          </View>
        </View>

        <View className="flex-1 px-6 pt-8 pb-6 gap-5">
          {serverError && (
            <View className="bg-danger-light border border-danger/30 rounded-xl px-4 py-3">
              <Text className="text-sm font-medium text-danger">{serverError}</Text>
            </View>
          )}

          {/* ── Paso 1: Datos ── */}
          {step === 'datos' && (
            <View className="gap-4">
              <View className="flex-row gap-3">
                <View className="flex-1">
                  <Controller
                    control={form1.control}
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
                        error={form1.formState.errors.nombre?.message}
                      />
                    )}
                  />
                </View>
                <View className="flex-1">
                  <Controller
                    control={form1.control}
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
                        error={form1.formState.errors.apellido?.message}
                      />
                    )}
                  />
                </View>
              </View>

              <Controller
                control={form1.control}
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
                    error={form1.formState.errors.email?.message}
                  />
                )}
              />

              <Controller
                control={form1.control}
                name="telefono"
                render={({ field: { onChange, onBlur, value } }) => (
                  <Input
                    label="Teléfono (opcional)"
                    placeholder="+57 300 000 0000"
                    keyboardType="phone-pad"
                    autoCapitalize="none"
                    returnKeyType="next"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    error={form1.formState.errors.telefono?.message}
                  />
                )}
              />

              <Controller
                control={form1.control}
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
                    error={form1.formState.errors.password?.message}
                    hint="Mínimo 8 caracteres"
                  />
                )}
              />

              <Controller
                control={form1.control}
                name="confirmPassword"
                render={({ field: { onChange, onBlur, value } }) => (
                  <Input
                    label="Confirmar contraseña *"
                    placeholder="Repite la contraseña"
                    isPassword
                    returnKeyType="done"
                    onSubmitEditing={form1.handleSubmit(onSubmitDatos)}
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    error={form1.formState.errors.confirmPassword?.message}
                  />
                )}
              />

              <Button
                label={form1.formState.isSubmitting ? 'Enviando códigos…' : 'Continuar'}
                onPress={form1.handleSubmit(onSubmitDatos)}
                loading={form1.formState.isSubmitting}
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
          )}

          {/* ── Paso 2: OTP ── */}
          {step === 'otp' && data && (
            <View className="gap-5">
              {/* Email OTP */}
              <View className="bg-card border border-border rounded-2xl p-4 gap-3">
                <View className="flex-row items-center gap-2">
                  <Ionicons
                    name={emailVerified ? 'checkmark-circle' : 'mail-outline'}
                    size={20}
                    color={emailVerified ? '#22c55e' : '#6b7280'}
                  />
                  <Text className="text-sm font-semibold text-foreground">
                    Código de correo electrónico
                  </Text>
                </View>
                <Text className="text-xs text-muted-foreground">
                  Enviado a <Text className="font-medium">{data.email}</Text>
                </Text>
                {!emailVerified ? (
                  <>
                    <Input
                      label=""
                      placeholder="000000"
                      keyboardType="number-pad"
                      maxLength={6}
                      value={emailOtp}
                      onChangeText={setEmailOtp}
                      error={otpEmailError ?? undefined}
                    />
                    <View className="flex-row gap-2">
                      <View className="flex-1">
                        <Button
                          label={isVerifying ? 'Verificando…' : 'Verificar'}
                          onPress={verificarEmail}
                          loading={isVerifying}
                          size="sm"
                          fullWidth
                        />
                      </View>
                      <TouchableOpacity
                        onPress={reenviarEmail}
                        disabled={resendingEmail}
                        className="justify-center px-3"
                      >
                        <Text className="text-xs text-primary-500 font-medium">
                          {resendingEmail ? 'Reenviando…' : 'Reenviar'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </>
                ) : (
                  <Text className="text-sm text-success font-medium">✓ Correo verificado</Text>
                )}
              </View>

              <Button
                label={isCreating ? 'Creando cuenta…' : 'Crear cuenta'}
                onPress={crearCuenta}
                loading={isCreating}
                disabled={!emailVerified}
                fullWidth
                size="lg"
              />

              <TouchableOpacity onPress={() => setStep('datos')} className="items-center py-2">
                <Text className="text-sm text-muted-foreground">← Volver y editar datos</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
