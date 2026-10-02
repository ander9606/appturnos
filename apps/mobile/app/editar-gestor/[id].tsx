/**
 * Editar gestor — nombre/apellido/email/rol de un gestor ya creado, incluido
 * admin_empresa (una empresa puede tener varios, p.ej. socios). El backend
 * bloquea quitarle el rol de admin al único administrador activo.
 */
import React, { useState } from 'react';
import {
  View, Text, TextInput, Pressable, ActivityIndicator, Alert,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { authApi } from '@api-client';
import type { ActualizarGestorPayload } from '@api-client';
import { COLORS } from '@/lib/designTokens';
import { useRoleGuard } from '@/components/RoleGuard';
import { apiErrorMessage } from '@/lib/apiErrorMessage';

const ROL_OPTIONS: { value: NonNullable<ActualizarGestorPayload['rol']>; label: string }[] = [
  { value: 'jefe_turnos',   label: 'Jefe de Turnos' },
  { value: 'jefe_nomina',   label: 'Jefe de Nómina' },
  { value: 'nomina',        label: 'Nómina' },
  { value: 'admin_empresa', label: 'Administrador (socio)' },
];

export default function EditarGestorScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const params = useLocalSearchParams<{
    id: string; nombre?: string; apellido?: string; email?: string; rol?: string;
  }>();
  const id = Number(params.id);

  const [nombre,   setNombre]   = useState(params.nombre ?? '');
  const [apellido, setApellido] = useState(params.apellido ?? '');
  const [email,    setEmail]    = useState(params.email ?? '');
  const [rol,      setRol]      = useState<NonNullable<ActualizarGestorPayload['rol']>>(
    (params.rol as NonNullable<ActualizarGestorPayload['rol']>) ?? 'jefe_turnos',
  );

  const mutation = useMutation({
    mutationFn: (payload: ActualizarGestorPayload) => authApi.actualizarGestor(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['gestores'] });
      router.back();
    },
    onError: (err: unknown) => Alert.alert('Error', apiErrorMessage(err, 'No se pudo actualizar el gestor.')),
  });

  const denied = useRoleGuard(['admin_empresa']);
  if (denied) return denied;

  function handleGuardar() {
    if (!nombre.trim()) {
      Alert.alert('Campo requerido', 'El nombre es obligatorio.');
      return;
    }
    if (!email.trim()) {
      Alert.alert('Campo requerido', 'El email es obligatorio.');
      return;
    }
    mutation.mutate({ nombre: nombre.trim(), apellido: apellido.trim() || undefined, email: email.trim(), rol });
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Editar gestor', headerTintColor: COLORS.info }} />
      <SafeAreaView className="flex-1 bg-background" edges={['bottom']}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1">
          <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
            <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2">
              Nombre *
            </Text>
            <View className="bg-card border border-border rounded-2xl overflow-hidden mb-4">
              <TextInput
                value={nombre}
                onChangeText={setNombre}
                placeholder="Ej. Carlos"
                placeholderTextColor={COLORS.placeholder}
                className="px-4 h-14 text-base text-foreground"
                autoCorrect={false}
                autoFocus
              />
            </View>

            <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2">
              Apellido
            </Text>
            <View className="bg-card border border-border rounded-2xl overflow-hidden mb-4">
              <TextInput
                value={apellido}
                onChangeText={setApellido}
                placeholder="Ej. Ramírez"
                placeholderTextColor={COLORS.placeholder}
                className="px-4 h-14 text-base text-foreground"
                autoCorrect={false}
              />
            </View>

            <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2">
              Email *
            </Text>
            <View className="bg-card border border-border rounded-2xl overflow-hidden mb-4">
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="Ej. carlos@empresa.com"
                placeholderTextColor={COLORS.placeholder}
                className="px-4 h-14 text-base text-foreground"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">
              Rol
            </Text>
            <View className="gap-3 mb-8">
              {ROL_OPTIONS.map((opt) => {
                const active = rol === opt.value;
                return (
                  <Pressable
                    key={opt.value}
                    onPress={() => setRol(opt.value)}
                    className={`flex-row items-center justify-between p-4 rounded-2xl border active:opacity-70 ${
                      active ? 'border-info' : 'bg-card border-border'
                    }`}
                    style={active ? { backgroundColor: '#EFF6FF' } : {}}
                  >
                    <Text className={`text-sm font-semibold ${active ? 'text-info' : 'text-foreground'}`}>
                      {opt.label}
                    </Text>
                    {active && <Ionicons name="checkmark-circle" size={20} color={COLORS.info} />}
                  </Pressable>
                );
              })}
            </View>

            <Pressable
              onPress={handleGuardar}
              disabled={mutation.isPending}
              className="h-14 rounded-2xl items-center justify-center active:opacity-80 disabled:opacity-40"
              style={{ backgroundColor: COLORS.info }}
            >
              {mutation.isPending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="text-base font-semibold text-white">Guardar cambios</Text>
              )}
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </>
  );
}
