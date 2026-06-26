import React from 'react';
import {
  View,
  Text,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';

import { authApi } from '@api-client';
import { useAuthStore } from '@/features/auth/useAuthStore';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import type { ApiError } from '@api-client';

export default function CompletarPerfilScreen() {
  const usuario    = useAuthStore((s) => s.usuario);
  const setUsuario = useAuthStore((s) => s.setUsuario);

  const [telefono,    setTelefono]    = React.useState('');
  const [telefonoErr, setTelefonoErr] = React.useState<string | null>(null);
  const [loading,     setLoading]     = React.useState(false);

  const tel = () => telefono.trim().startsWith('+') ? telefono.trim() : `+57${telefono.trim()}`;

  const guardar = async () => {
    if (telefono.trim().length < 7) {
      setTelefonoErr('Introduce un número de teléfono válido');
      return;
    }
    setTelefonoErr(null);
    setLoading(true);
    try {
      const perfilActualizado = await authApi.updateProfile({ telefono: tel() });
      await setUsuario(perfilActualizado);
    } catch (err) {
      setTelefonoErr((err as ApiError)?.message ?? 'No se pudo guardar. Intenta de nuevo.');
    } finally {
      setLoading(false);
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
        <View className="items-center justify-end bg-primary-600 pt-16 pb-10 rounded-b-[40px]">
          <View className="w-20 h-20 rounded-2xl bg-white/20 items-center justify-center mb-4">
            <Ionicons name="phone-portrait-outline" size={40} color="white" />
          </View>
          <Text className="text-2xl font-bold text-white">Un último paso</Text>
          <Text className="text-sm text-white/80 mt-1 px-8 text-center">
            Hola {usuario?.nombre ?? ''}, agrega tu número para completar el registro
          </Text>
        </View>

        <View className="flex-1 px-6 pt-8 pb-6 gap-5">
          <Input
            label="Número de teléfono *"
            placeholder="300 000 0000"
            keyboardType="phone-pad"
            autoCapitalize="none"
            value={telefono}
            onChangeText={setTelefono}
            error={telefonoErr ?? undefined}
          />
          <Button
            label={loading ? 'Guardando…' : 'Continuar'}
            onPress={guardar}
            loading={loading}
            fullWidth
            size="lg"
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
