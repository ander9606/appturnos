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
import { useMutation } from '@tanstack/react-query';

import { authApi } from '@api-client';
import { COLORS } from '@/lib/designTokens';
import type { CrearGestorPayload, CrearGestorResult, ApiError } from '@api-client';

// ── Constants ─────────────────────────────────────────────────────────────

const ROL_OPTIONS: { value: CrearGestorPayload['rol']; label: string; desc: string; icon: string }[] = [
  {
    value: 'jefe_turnos',
    label: 'Jefe de Turnos',
    desc: 'Gestiona turnos, ofertas y equipo',
    icon: 'calendar-outline',
  },
  {
    value: 'jefe_nomina',
    label: 'Jefe de Nómina',
    desc: 'Gestiona períodos y liquidaciones',
    icon: 'wallet-outline',
  },
  {
    value: 'nomina',
    label: 'Nómina',
    desc: 'Visualiza nómina y equipo',
    icon: 'document-text-outline',
  },
];

// ── Screen ────────────────────────────────────────────────────────────────

export default function CrearGestorScreen() {
  const router = useRouter();

  const [nombre,   setNombre]   = useState('');
  const [apellido, setApellido] = useState('');
  const [email,    setEmail]    = useState('');
  const [rol,      setRol]      = useState<CrearGestorPayload['rol']>('jefe_turnos');
  const [resultado, setResultado] = useState<CrearGestorResult | null>(null);

  const mutation = useMutation({
    mutationFn: (payload: CrearGestorPayload) => authApi.crearGestor(payload),
  });

  function handleCrear() {
    if (!nombre.trim()) {
      Alert.alert('Campo requerido', 'El nombre es obligatorio.');
      return;
    }
    if (!email.trim()) {
      Alert.alert('Campo requerido', 'El email es obligatorio.');
      return;
    }

    mutation.mutate(
      { nombre: nombre.trim(), apellido: apellido.trim() || undefined, email: email.trim(), rol },
      {
        onSuccess: (data) => setResultado(data),
        onError: (err: unknown) => {
          const apiErr = err as ApiError;
          if (apiErr.status === 409) {
            Alert.alert('Email en uso', 'Ya existe un usuario con ese email en la plataforma.');
          } else {
            Alert.alert('Error', apiErr.message ?? 'No se pudo crear el gestor.');
          }
        },
      },
    );
  }

  // ── Success state ────────────────────────────────────────────────────────

  if (resultado) {
    const rolLabel = ROL_OPTIONS.find((r) => r.value === resultado.rol)?.label ?? resultado.rol;

    return (
      <>
        <Stack.Screen options={{ title: 'Crear gestor', headerTintColor: COLORS.info }} />
        <SafeAreaView className="flex-1 bg-background" edges={['bottom']}>
          <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 40 }}>
            {/* Ícono de éxito */}
            <View className="items-center mb-6 mt-4">
              <View
                className="w-16 h-16 rounded-full items-center justify-center mb-3"
                style={{ backgroundColor: '#DCFCE7' }}
              >
                <Ionicons name="checkmark-circle" size={40} color="#16A34A" />
              </View>
              <Text className="text-xl font-bold text-foreground">¡Cuenta creada!</Text>
              <Text className="text-sm text-muted-foreground mt-1 text-center">
                {resultado.nombre} {resultado.apellido ?? ''} fue registrado como {rolLabel}
              </Text>
            </View>

            {/* Credenciales */}
            <View className="bg-warning/10 border border-warning/30 rounded-2xl p-5 mb-6">
              <View className="flex-row items-center gap-2 mb-3">
                <Ionicons name="key-outline" size={16} color="#D97706" />
                <Text className="text-sm font-bold text-warning">Credenciales de acceso</Text>
              </View>

              <Text className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Email</Text>
              <Text className="text-sm font-medium text-foreground mb-3 font-mono">{resultado.email}</Text>

              <Text className="text-xs text-muted-foreground uppercase tracking-widest mb-1">
                Contraseña temporal
              </Text>
              <View className="bg-card border border-border rounded-xl px-4 py-3">
                <Text className="text-xl font-bold text-foreground tracking-widest text-center font-mono">
                  {resultado.password_temporal}
                </Text>
              </View>

              <View className="flex-row items-start gap-2 mt-3">
                <Ionicons name="alert-circle-outline" size={14} color="#D97706" style={{ marginTop: 1 }} />
                <Text className="text-xs text-warning flex-1">
                  Guarda esta contraseña — solo se muestra una vez. El usuario deberá cambiarla al iniciar sesión.
                </Text>
              </View>
            </View>

            {/* Pasos siguientes */}
            <View className="bg-info/10 rounded-2xl p-4 mb-6">
              <Text className="text-sm font-semibold text-info mb-2">Próximos pasos</Text>
              <Text className="text-sm text-foreground">
                1. Comparte el email y la contraseña temporal con {resultado.nombre}.{'\n'}
                2. Que inicie sesión en la app.{'\n'}
                3. Ir a Perfil → Cambiar contraseña para actualizarla.
              </Text>
            </View>

            <Pressable
              onPress={() => router.back()}
              className="h-14 rounded-2xl items-center justify-center active:opacity-80"
              style={{ backgroundColor: COLORS.info }}
            >
              <Text className="text-base font-semibold text-white">Listo</Text>
            </Pressable>
          </ScrollView>
        </SafeAreaView>
      </>
    );
  }

  // ── Form ─────────────────────────────────────────────────────────────────

  return (
    <>
      <Stack.Screen options={{ title: 'Crear gestor', headerTintColor: COLORS.info }} />
      <SafeAreaView className="flex-1 bg-background" edges={['bottom']}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          className="flex-1"
        >
          <ScrollView
            contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
            keyboardShouldPersistTaps="handled"
          >
            {/* Info */}
            <View className="bg-info/10 rounded-2xl p-4 mb-6 flex-row gap-3">
              <Ionicons name="information-circle-outline" size={18} color={COLORS.info} style={{ marginTop: 1 }} />
              <Text className="text-sm text-foreground flex-1">
                Crea una cuenta para un miembro de tu equipo de gestión. Se generará una contraseña temporal que deberás compartir con esa persona.
              </Text>
            </View>

            {/* Nombre */}
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

            {/* Apellido */}
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

            {/* Email */}
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

            {/* Rol */}
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
                    className={`flex-row items-center gap-3 p-4 rounded-2xl border active:opacity-70 ${
                      active ? 'border-info' : 'bg-card border-border'
                    }`}
                    style={active ? { backgroundColor: '#EFF6FF' } : {}}
                  >
                    <View
                      className="w-10 h-10 rounded-full items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: active ? COLORS.info : '#F1F5F9' }}
                    >
                      <Ionicons
                        name={opt.icon as any}
                        size={18}
                        color={active ? '#fff' : '#64748B'}
                      />
                    </View>
                    <View className="flex-1">
                      <Text className={`text-sm font-semibold ${active ? 'text-info' : 'text-foreground'}`}>
                        {opt.label}
                      </Text>
                      <Text className="text-xs text-muted-foreground mt-0.5">{opt.desc}</Text>
                    </View>
                    {active && <Ionicons name="checkmark-circle" size={20} color={COLORS.info} />}
                  </Pressable>
                );
              })}
            </View>

            {/* Crear */}
            <Pressable
              onPress={handleCrear}
              disabled={mutation.isPending}
              className="h-14 rounded-2xl items-center justify-center active:opacity-80 disabled:opacity-40"
              style={{ backgroundColor: COLORS.info }}
            >
              {mutation.isPending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <View className="flex-row items-center gap-2">
                  <Ionicons name="person-add-outline" size={18} color="#fff" />
                  <Text className="text-base font-semibold text-white">Crear cuenta</Text>
                </View>
              )}
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </>
  );
}
