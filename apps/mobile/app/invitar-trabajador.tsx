import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useBuscarPorCedula } from '@/features/equipo/useEquipo';
import { useInvitar } from '@/features/empresas/useTrabajadorEmpresa';
import { COLORS } from '@/lib/designTokens';
import type { ApiError } from '@api-client';

// ── Helpers ────────────────────────────────────────────────────────────────

function getInitials(nombre?: string, apellido?: string) {
  return ((nombre?.[0] ?? '') + (apellido?.[0] ?? '')).toUpperCase() || '?';
}

// ── Screen ─────────────────────────────────────────────────────────────────

export default function InvitarTrabajadorScreen() {
  const router  = useRouter();
  const [cedula, setCedula] = useState('');
  const [debouncedCedula, setDebouncedCedula] = useState('');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce la cédula 600ms para no disparar una búsqueda por cada tecla
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setDebouncedCedula(cedula.trim()), 600);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [cedula]);

  const { data: trabajador, isFetching, isError, error } = useBuscarPorCedula(debouncedCedula);
  const invitar = useInvitar();

  const notFound = isError && (error as ApiError)?.status === 404 && debouncedCedula.length >= 5;
  const canSend  = !!trabajador && !isFetching;

  function handleInvitar() {
    if (!canSend) return;
    invitar.mutate(cedula.trim(), {
      onSuccess: () => {
        Alert.alert(
          'Invitación enviada',
          `${trabajador!.nombre} ${trabajador!.apellido} recibirá una notificación para unirse a tu empresa.`,
          [{ text: 'Listo', onPress: () => router.back() }]
        );
      },
      onError: (err: unknown) => {
        Alert.alert('Error', (err as ApiError).message ?? 'No se pudo enviar la invitación.');
      },
    });
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Invitar trabajador',
          headerTintColor: COLORS.info,
        }}
      />
      <SafeAreaView className="flex-1 bg-background" edges={['bottom']}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          className="flex-1"
        >
          <ScrollView
            contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
            keyboardShouldPersistTaps="handled"
          >
            {/* Instrucción */}
            <View className="bg-info/10 rounded-2xl p-4 mb-6 flex-row gap-3">
              <Ionicons name="information-circle-outline" size={20} color={COLORS.info} style={{ marginTop: 1 }} />
              <Text className="text-sm text-foreground flex-1">
                Ingresa la cédula del trabajador. Si tiene cuenta activa en la plataforma verás su perfil antes de enviar la invitación.
              </Text>
            </View>

            {/* Input cédula */}
            <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2">
              Número de cédula
            </Text>
            <View className="bg-card border border-border rounded-2xl overflow-hidden mb-4">
              <View className="flex-row items-center px-4 h-14 gap-3">
                <Ionicons name="card-outline" size={18} color="#64748B" />
                <TextInput
                  value={cedula}
                  onChangeText={setCedula}
                  placeholder="Ej. 1012345678"
                  placeholderTextColor={COLORS.placeholder}
                  keyboardType="number-pad"
                  className="flex-1 text-base text-foreground"
                  autoCorrect={false}
                  returnKeyType="search"
                  autoFocus
                />
                {isFetching && debouncedCedula.length >= 5 && (
                  <ActivityIndicator size="small" color={COLORS.info} />
                )}
                {cedula.length > 0 && !isFetching && (
                  <Pressable onPress={() => { setCedula(''); setDebouncedCedula(''); }} hitSlop={8}>
                    <Ionicons name="close-circle" size={18} color="#94A3B8" />
                  </Pressable>
                )}
              </View>
            </View>

            {/* Resultado de búsqueda */}
            {trabajador && !isFetching && (
              <View className="bg-card border border-success/40 rounded-2xl p-4 mb-6 flex-row items-center gap-3">
                <View className="w-11 h-11 rounded-full bg-success/10 items-center justify-center">
                  <Text className="text-success font-bold text-base">
                    {getInitials(trabajador.nombre, trabajador.apellido)}
                  </Text>
                </View>
                <View className="flex-1">
                  <Text className="text-base font-semibold text-foreground">
                    {trabajador.nombre} {trabajador.apellido}
                  </Text>
                  <Text className="text-xs text-muted-foreground mt-0.5">
                    {trabajador.tipo_documento ?? 'CC'} {trabajador.cedula}
                    {trabajador.cargo ? ` · ${trabajador.cargo}` : ''}
                  </Text>
                </View>
                <Ionicons name="checkmark-circle" size={22} color={COLORS.success} />
              </View>
            )}

            {notFound && (
              <View className="bg-danger/10 border border-danger/30 rounded-2xl p-4 mb-6 flex-row gap-3">
                <Ionicons name="alert-circle-outline" size={18} color={COLORS.danger} style={{ marginTop: 1 }} />
                <Text className="text-sm text-danger flex-1">
                  No se encontró ningún trabajador con esa cédula en la plataforma. Verifica el número o pídele que se registre primero.
                </Text>
              </View>
            )}

            {/* Botón enviar */}
            <Pressable
              onPress={handleInvitar}
              disabled={!canSend || invitar.isPending}
              className="h-14 rounded-2xl items-center justify-center active:opacity-80 disabled:opacity-40"
              style={{ backgroundColor: COLORS.info }}
            >
              {invitar.isPending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <View className="flex-row items-center gap-2">
                  <Ionicons name="person-add-outline" size={18} color="#fff" />
                  <Text className="text-base font-semibold text-white">Enviar invitación</Text>
                </View>
              )}
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </>
  );
}
