import React, { useState } from 'react';
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

import { useInvitar } from '@/features/empresas/useTrabajadorEmpresa';
import { COLORS } from '@/lib/designTokens';
import type { ApiError } from '@api-client';

export default function InvitarTrabajadorScreen() {
  const router  = useRouter();
  const [cedula, setCedula] = useState('');
  const invitar = useInvitar();

  function handleInvitar() {
    const c = cedula.trim();
    if (!c) {
      Alert.alert('Campo requerido', 'Ingresa el número de cédula del trabajador.');
      return;
    }
    invitar.mutate(c, {
      onSuccess: (vinculo) => {
        Alert.alert(
          'Invitación enviada',
          `Se envió una invitación a ${vinculo.empresa_nombre ? `la cédula ${c}` : `cédula ${c}`}. El trabajador deberá aceptarla desde su app.`,
          [{ text: 'Aceptar', onPress: () => router.back() }]
        );
      },
      onError: (err: ApiError) => {
        Alert.alert('Error', err.message ?? 'No se pudo enviar la invitación.');
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
            {/* Descripción */}
            <View className="bg-info/10 rounded-2xl p-4 mb-6 flex-row gap-3">
              <Ionicons name="information-circle-outline" size={20} color={COLORS.info} style={{ marginTop: 1 }} />
              <Text className="text-sm text-foreground flex-1">
                Busca al trabajador por su número de cédula. Si existe en la plataforma, recibirá una invitación para unirse a tu empresa.
              </Text>
            </View>

            {/* Input cédula */}
            <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2">
              Número de cédula
            </Text>
            <View className="bg-card border border-border rounded-2xl overflow-hidden mb-6">
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
                  returnKeyType="send"
                  onSubmitEditing={handleInvitar}
                />
                {cedula.length > 0 && (
                  <Pressable onPress={() => setCedula('')} hitSlop={8}>
                    <Ionicons name="close-circle" size={18} color="#94A3B8" />
                  </Pressable>
                )}
              </View>
            </View>

            {/* Botón enviar */}
            <Pressable
              onPress={handleInvitar}
              disabled={invitar.isPending || cedula.trim().length === 0}
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
