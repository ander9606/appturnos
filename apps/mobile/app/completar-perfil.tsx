/**
 * Pantalla: Completar perfil — teléfono
 *
 * Flujo post-OAuth (Google):
 *   1. Usuario ingresa su número de teléfono
 *   2. Se envía OTP por SMS
 *   3. Usuario verifica el código
 *   4. Se guarda el teléfono en el perfil (PATCH /api/auth/me)
 *   5. AuthGuard detecta telefono != null → redirige a (tabs)
 */
import React from 'react';
import {
  View,
  Text,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';

import { authApi } from '@api-client';
import { useAuthStore } from '@/features/auth/useAuthStore';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import type { ApiError } from '@api-client';

type Step = 'telefono' | 'otp';

export default function CompletarPerfilScreen() {
  const usuario    = useAuthStore((s) => s.usuario);
  const setUsuario = useAuthStore((s) => s.setUsuario);

  const [step,        setStep]        = React.useState<Step>('telefono');
  const [telefono,    setTelefono]    = React.useState('');
  const [telefonoErr, setTelefonoErr] = React.useState<string | null>(null);
  const [otp,         setOtp]         = React.useState('');
  const [otpErr,      setOtpErr]      = React.useState<string | null>(null);
  const [loading,     setLoading]     = React.useState(false);
  const [resending,   setResending]   = React.useState(false);

  const telefonoToken = React.useRef<string | null>(null);

  const enviarOtp = async () => {
    if (telefono.trim().length < 7) {
      setTelefonoErr('Introduce un número de teléfono válido (incluye código de país, ej. +57)');
      return;
    }
    setTelefonoErr(null);
    setLoading(true);
    try {
      await authApi.enviarOtp({ tipo: 'telefono', destino: telefono.trim() });
      setStep('otp');
    } catch (err) {
      setTelefonoErr((err as ApiError)?.message ?? 'No se pudo enviar el código. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const verificarYGuardar = async () => {
    if (otp.length !== 6) { setOtpErr('El código tiene 6 dígitos'); return; }
    setOtpErr(null);
    setLoading(true);
    try {
      const { token } = await authApi.verificarOtp({ tipo: 'telefono', destino: telefono.trim(), codigo: otp });
      telefonoToken.current = token;

      // Persist to backend and update local store
      const perfilActualizado = await authApi.updateProfile({
        telefono: telefono.trim(),
        telefono_token: token,
      });
      await setUsuario(perfilActualizado);
      // AuthGuard re-runs due to usuario change and redirects to (tabs)
    } catch (err) {
      setOtpErr((err as ApiError)?.message ?? 'Código incorrecto o expirado.');
    } finally {
      setLoading(false);
    }
  };

  const reenviar = async () => {
    setResending(true);
    try { await authApi.enviarOtp({ tipo: 'telefono', destino: telefono.trim() }); }
    finally { setResending(false); }
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
            <Ionicons
              name={step === 'telefono' ? 'phone-portrait-outline' : 'shield-checkmark-outline'}
              size={40}
              color="white"
            />
          </View>
          <Text className="text-2xl font-bold text-white">
            {step === 'telefono' ? 'Un último paso' : 'Verificar teléfono'}
          </Text>
          <Text className="text-sm text-white/80 mt-1 px-8 text-center">
            {step === 'telefono'
              ? `Hola ${usuario?.nombre ?? ''}, necesitamos verificar tu número para completar el registro`
              : `Ingresa el código que enviamos a ${telefono}`}
          </Text>
        </View>

        <View className="flex-1 px-6 pt-8 pb-6 gap-5">
          {step === 'telefono' && (
            <View className="gap-4">
              <Input
                label="Número de teléfono *"
                placeholder="+57 300 000 0000"
                keyboardType="phone-pad"
                autoCapitalize="none"
                value={telefono}
                onChangeText={setTelefono}
                error={telefonoErr ?? undefined}
                hint="Incluye el código de país, ej. +57"
              />
              <Button
                label={loading ? 'Enviando…' : 'Enviar código'}
                onPress={enviarOtp}
                loading={loading}
                fullWidth
                size="lg"
              />
            </View>
          )}

          {step === 'otp' && (
            <View className="gap-4">
              <View className="bg-card border border-border rounded-2xl p-4 gap-3">
                <Text className="text-sm text-muted-foreground">
                  Código enviado a <Text className="font-semibold text-foreground">{telefono}</Text>
                </Text>
                <Input
                  label="Código de verificación"
                  placeholder="000000"
                  keyboardType="number-pad"
                  maxLength={6}
                  value={otp}
                  onChangeText={setOtp}
                  error={otpErr ?? undefined}
                />
                <View className="flex-row gap-2 items-center">
                  <View className="flex-1">
                    <Button
                      label={loading ? 'Verificando…' : 'Verificar y continuar'}
                      onPress={verificarYGuardar}
                      loading={loading}
                      size="sm"
                      fullWidth
                    />
                  </View>
                  <TouchableOpacity onPress={reenviar} disabled={resending} className="px-3 py-2">
                    <Text className="text-xs text-primary-500 font-medium">
                      {resending ? 'Reenviando…' : 'Reenviar'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              <TouchableOpacity onPress={() => setStep('telefono')} className="items-center py-2">
                <Text className="text-sm text-muted-foreground">← Cambiar número</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
