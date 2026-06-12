/**
 * Mi empresa — perfil de la empresa para el admin_empresa.
 * Campos: logo, razón social, NIT, ciudad, actividad, descripción,
 *         acepta_postulaciones (visible en directorio marketplace).
 */
import React, { useEffect } from 'react';
import {
  View, Text, ScrollView, Switch, Alert,
  KeyboardAvoidingView, Platform, Image, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Ionicons } from '@expo/vector-icons';

import { empresasApi } from '@api-client';
import type { ActualizarMiEmpresaPayload } from '@api-client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useTheme } from '@/lib/theme';

// ── Schema ────────────────────────────────────────────────────────────────

const schema = z.object({
  nombre:               z.string().trim().min(1, 'Razón social requerida'),
  nit:                  z.string().trim().optional(),
  ciudad:               z.string().trim().optional(),
  actividad:            z.string().trim().optional(),
  descripcion:          z.string().trim().optional(),
  logo_url:             z.string().trim().url('Debe ser una URL válida').optional().or(z.literal('')),
  acepta_postulaciones: z.boolean(),
});

type FormData = z.infer<typeof schema>;

// ── Hooks ─────────────────────────────────────────────────────────────────

function useMiEmpresa() {
  return useQuery({
    queryKey: ['mi-empresa'],
    queryFn: () => empresasApi.obtenerMiEmpresa(),
    staleTime: 300_000,
  });
}

function useActualizarEmpresa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (datos: ActualizarMiEmpresaPayload) =>
      empresasApi.actualizarMiEmpresa(datos),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mi-empresa'] }),
  });
}

// ── Screen ────────────────────────────────────────────────────────────────

export default function MiEmpresaScreen() {
  const theme  = useTheme();
  const { data: empresa, isLoading } = useMiEmpresa();
  const actualizar = useActualizarEmpresa();

  const {
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      nombre:               '',
      nit:                  '',
      ciudad:               '',
      actividad:            '',
      descripcion:          '',
      logo_url:             '',
      acepta_postulaciones: true,
    },
  });

  const logoUrl = watch('logo_url');

  useEffect(() => {
    if (empresa) {
      reset({
        nombre:               empresa.nombre ?? '',
        nit:                  empresa.nit ?? '',
        ciudad:               empresa.ciudad ?? '',
        actividad:            empresa.actividad ?? '',
        descripcion:          empresa.descripcion ?? '',
        logo_url:             empresa.logo_url ?? '',
        acepta_postulaciones: Boolean(empresa.acepta_postulaciones),
      });
    }
  }, [empresa, reset]);

  const onSubmit = async (data: FormData) => {
    try {
      await actualizar.mutateAsync({
        nombre:               data.nombre,
        nit:                  data.nit       || undefined,
        ciudad:               data.ciudad    || undefined,
        actividad:            data.actividad || undefined,
        descripcion:          data.descripcion || undefined,
        logo_url:             data.logo_url  || undefined,
        acepta_postulaciones: data.acepta_postulaciones,
      });
      Alert.alert('✓ Guardado', 'Datos de la empresa actualizados.');
    } catch {
      Alert.alert('Error', 'No se pudo guardar. Intenta de nuevo.');
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center" edges={['bottom']}>
        <Stack.Screen options={{ title: 'Mi empresa', headerShown: true }} />
        <ActivityIndicator size="large" color={theme.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['bottom']}>
      <Stack.Screen options={{ title: 'Mi empresa', headerShown: true }} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView
          contentContainerStyle={{ padding: 20, paddingBottom: 48, gap: 20 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Logo ─────────────────────────────────────────────── */}
          <View className="items-center gap-3">
            <View className="w-24 h-24 rounded-2xl bg-muted items-center justify-center overflow-hidden">
              {logoUrl ? (
                <Image
                  source={{ uri: logoUrl }}
                  className="w-24 h-24"
                  resizeMode="contain"
                  onError={() => {}}
                />
              ) : (
                <Ionicons name="business-outline" size={40} color="#94A3B8" />
              )}
            </View>
            <Text className="text-xs text-muted-foreground text-center">
              Pega la URL pública del logo en el campo de abajo
            </Text>
          </View>

          <Controller
            control={control}
            name="logo_url"
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                label="URL del logo"
                placeholder="https://mi-empresa.com/logo.png"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={errors.logo_url?.message}
              />
            )}
          />

          {/* ── Datos legales ─────────────────────────────────────── */}
          <View className="gap-1">
            <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
              Datos legales
            </Text>
          </View>

          <Controller
            control={control}
            name="nombre"
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                label="Razón social *"
                placeholder="Logística Demo S.A.S."
                autoCapitalize="words"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={errors.nombre?.message}
              />
            )}
          />

          <Controller
            control={control}
            name="nit"
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                label="NIT"
                placeholder="900.123.456-7"
                keyboardType="default"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={errors.nit?.message}
              />
            )}
          />

          <Controller
            control={control}
            name="actividad"
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                label="Actividad económica"
                placeholder="Ej. Transporte de carga, Manufactura textil…"
                autoCapitalize="sentences"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={errors.actividad?.message}
              />
            )}
          />

          <Controller
            control={control}
            name="ciudad"
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                label="Ciudad"
                placeholder="Bogotá"
                autoCapitalize="words"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={errors.ciudad?.message}
              />
            )}
          />

          {/* ── Presentación pública ──────────────────────────────── */}
          <View className="gap-1 mt-2">
            <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
              Presentación pública
            </Text>
          </View>

          <Controller
            control={control}
            name="descripcion"
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                label="Descripción"
                placeholder="Cuéntale a los trabajadores de qué trata tu empresa…"
                autoCapitalize="sentences"
                multiline
                numberOfLines={4}
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={errors.descripcion?.message}
              />
            )}
          />

          {/* Acepta postulaciones */}
          <View className="bg-card border border-border rounded-2xl px-5 py-4 flex-row items-center justify-between">
            <View className="flex-1 mr-4">
              <Text className="text-sm font-semibold text-foreground">Visible en el directorio</Text>
              <Text className="text-xs text-muted-foreground mt-0.5">
                Los trabajadores turnos pueden ver tu empresa y solicitar vinculación
              </Text>
            </View>
            <Controller
              control={control}
              name="acepta_postulaciones"
              render={({ field: { onChange, value } }) => (
                <Switch
                  value={value}
                  onValueChange={onChange}
                  trackColor={{ true: theme.primary }}
                  thumbColor="#fff"
                />
              )}
            />
          </View>

          {/* Guardar */}
          <Button
            label={isSubmitting ? 'Guardando…' : 'Guardar cambios'}
            onPress={handleSubmit(onSubmit)}
            loading={isSubmitting}
            disabled={!isDirty}
            fullWidth
            size="lg"
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
