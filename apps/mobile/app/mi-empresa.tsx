/**
 * Mi empresa — perfil de la empresa para el admin_empresa.
 * Campos: logo, razón social, NIT, ciudad, actividad, descripción,
 *         acepta_postulaciones (visible en directorio marketplace).
 */
import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, Switch, Alert, Pressable,
  KeyboardAvoidingView, Platform, Image, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Ionicons } from '@expo/vector-icons';

import { empresasApi } from '@api-client';
import type { ActualizarMiEmpresaPayload, TipoLiquidacion, TipoContrato } from '@api-client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useTheme } from '@/lib/theme';
import { showToast } from '@/lib/toast';
import { webSafeSecureStore as SecureStore } from '@/lib/secureStore';
import * as WebBrowser from 'expo-web-browser';

// ── Schema ────────────────────────────────────────────────────────────────

const TIPO_LIQUIDACION_OPTIONS: { value: TipoLiquidacion; label: string; sub: string }[] = [
  { value: 'mensual',    label: 'Mensual',    sub: 'Ej. 1–30 Jun' },
  { value: 'quincenal',  label: 'Quincenal',  sub: 'Ej. 1–15 / 16–30' },
  { value: 'semanal',    label: 'Semanal',    sub: 'Lun–Dom' },
];

const TIPO_CONTRATO_OPTIONS: { value: TipoContrato; label: string; sub: string }[] = [
  { value: 'laboral',              label: 'Contrato laboral',        sub: 'Descuenta salud y pensión' },
  { value: 'prestacion_servicios', label: 'Prestación de servicios', sub: 'El independiente se autoliquida' },
];

const schema = z.object({
  nombre:               z.string().trim().min(1, 'Razón social requerida'),
  nit:                  z.string().trim().optional(),
  ciudad:               z.string().trim().optional(),
  actividad:            z.string().trim().optional(),
  descripcion:          z.string().trim().optional(),
  // Ya no se tipea a mano — se sube por cámara/galería (data URI) o queda como URL externa preexistente.
  logo_url:             z.string().optional().or(z.literal('')),
  acepta_postulaciones: z.boolean(),
  tipo_liquidacion:     z.enum(['mensual', 'quincenal', 'semanal']),
  tipo_contrato:        z.enum(['laboral', 'prestacion_servicios']),
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mi-empresa'] });
      // Cambiar tipo_liquidacion recalcula el período en el backend (cierra el
      // abierto y abre uno nuevo con el ciclo correcto) — sin esto, todos los
      // que ya tenían 'periodos' en caché siguen viendo el período/tipo viejo
      // hasta que remonten la pantalla o pase el staleTime.
      qc.invalidateQueries({ queryKey: ['periodos'] });
    },
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
      tipo_liquidacion:     'mensual' as TipoLiquidacion,
      tipo_contrato:        'laboral' as TipoContrato,
    },
  });

  const logoUrl = watch('logo_url');
  const [uploadingLogo, setUploadingLogo] = useState(false);

  // ── Logo — mismo flujo de cámara/galería que la foto de perfil de usuario ──

  const handleCambiarLogo = () => {
    Alert.alert('Logo de la empresa', undefined, [
      {
        text: 'Tomar foto',
        onPress: async () => {
          const ImagePicker = await import('expo-image-picker');
          const perm = await ImagePicker.requestCameraPermissionsAsync();
          if (!perm.granted) { Alert.alert('Permiso requerido', 'Permite el acceso a la cámara.'); return; }
          const result = await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.5, base64: true, allowsEditing: true, aspect: [1, 1] });
          if (!result.canceled && result.assets[0]?.base64) _subirLogo(result.assets[0].base64);
        },
      },
      {
        text: 'Galería',
        onPress: async () => {
          const ImagePicker = await import('expo-image-picker');
          const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (!perm.granted) { Alert.alert('Permiso requerido', 'Permite el acceso a la galería.'); return; }
          const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.5, base64: true, allowsEditing: true, aspect: [1, 1] });
          if (!result.canceled && result.assets[0]?.base64) _subirLogo(result.assets[0].base64);
        },
      },
      logoUrl ? { text: 'Quitar logo', style: 'destructive' as const, onPress: () => _subirLogo(null) } : null,
      { text: 'Cancelar', style: 'cancel' as const },
    ].filter(Boolean) as any[]);
  };

  const _subirLogo = async (b64: string | null) => {
    setUploadingLogo(true);
    try {
      await actualizar.mutateAsync({ logo_url: b64 ? `data:image/jpeg;base64,${b64}` : '' });
      showToast(b64 ? 'Logo actualizado.' : 'Logo eliminado.');
    } catch {
      Alert.alert('Error', 'No se pudo actualizar el logo. Intenta de nuevo.');
    } finally {
      setUploadingLogo(false);
    }
  };

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
        tipo_liquidacion:     (empresa.tipo_liquidacion ?? 'mensual') as TipoLiquidacion,
        tipo_contrato:        (empresa.tipo_contrato ?? 'laboral') as TipoContrato,
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
        tipo_liquidacion:     data.tipo_liquidacion,
        tipo_contrato:        data.tipo_contrato,
      });
      showToast('Datos de la empresa actualizados.');
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
          {/* ── Logo — toca para cambiarlo (cámara/galería), igual que la foto de perfil ── */}
          <View className="items-center gap-3">
            <Pressable onPress={handleCambiarLogo} disabled={uploadingLogo} className="relative active:opacity-70">
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
              <View className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-primary items-center justify-center border-2 border-background">
                {uploadingLogo ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Ionicons name="camera" size={14} color="#fff" />
                )}
              </View>
            </Pressable>
            <Text className="text-xs text-muted-foreground text-center">
              Toca el logo para cambiarlo
            </Text>
            {errors.logo_url && (
              <Text className="text-xs text-danger text-center">{errors.logo_url.message}</Text>
            )}
          </View>

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

          {/* ── Ciclo de pago de nómina ──────────────────────────── */}
          <View className="gap-3 mt-2">
            <View className="gap-1">
              <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
                Ciclo de nómina
              </Text>
              <Text className="text-xs text-muted-foreground">
                Determina cómo se crean automáticamente los períodos de nómina por hora.
              </Text>
            </View>
            <Controller
              control={control}
              name="tipo_liquidacion"
              render={({ field: { onChange, value } }) => (
                <View className="flex-row gap-2">
                  {TIPO_LIQUIDACION_OPTIONS.map((opt) => {
                    const active = value === opt.value;
                    return (
                      <View
                        key={opt.value}
                        className={`flex-1 rounded-2xl border py-3 px-2 items-center gap-0.5 ${
                          active ? 'border-primary-500 bg-primary/10' : 'border-border bg-card'
                        }`}
                        // ponytail: TouchableOpacity wrapping needed
                      >
                        <Text
                          onPress={() => onChange(opt.value)}
                          className={`text-sm font-bold ${active ? 'text-primary-500' : 'text-foreground'}`}
                        >
                          {opt.label}
                        </Text>
                        <Text className="text-[10px] text-muted-foreground text-center">{opt.sub}</Text>
                      </View>
                    );
                  })}
                </View>
              )}
            />
          </View>

          {/* ── Régimen de contratación ───────────────────────────── */}
          <View className="gap-3 mt-2">
            <View className="gap-1">
              <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
                Régimen de contratación
              </Text>
              <Text className="text-xs text-muted-foreground">
                Determina si la liquidación descuenta salud y pensión del pago de cada trabajador.
              </Text>
            </View>
            <Controller
              control={control}
              name="tipo_contrato"
              render={({ field: { onChange, value } }) => (
                <View className="flex-row gap-2">
                  {TIPO_CONTRATO_OPTIONS.map((opt) => {
                    const active = value === opt.value;
                    return (
                      <View
                        key={opt.value}
                        className={`flex-1 rounded-2xl border py-3 px-2 items-center gap-0.5 ${
                          active ? 'border-primary-500 bg-primary/10' : 'border-border bg-card'
                        }`}
                        // ponytail: TouchableOpacity wrapping needed
                      >
                        <Text
                          onPress={() => onChange(opt.value)}
                          className={`text-sm font-bold ${active ? 'text-primary-500' : 'text-foreground'}`}
                        >
                          {opt.label}
                        </Text>
                        <Text className="text-[10px] text-muted-foreground text-center">{opt.sub}</Text>
                      </View>
                    );
                  })}
                </View>
              )}
            />
          </View>

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

          {/* Cómo calculamos los pagos */}
          <Pressable
            onPress={async () => {
              const token = await SecureStore.getItemAsync('appturnos.access_token');
              const base  = process.env.EXPO_PUBLIC_API_URL;
              await WebBrowser.openBrowserAsync(`${base}/api/empresas/reglas-pago?token=${token}`);
            }}
            accessibilityRole="button"
            accessibilityLabel="Descargar PDF: cómo calculamos los pagos"
            className="flex-row items-center gap-3 bg-card border border-border rounded-2xl px-4 py-3 active:opacity-70"
          >
            <Ionicons name="document-text-outline" size={22} color={theme.primary} />
            <View className="flex-1">
              <Text className="text-sm font-semibold text-foreground">Cómo calculamos los pagos</Text>
              <Text className="text-xs text-muted-foreground">Horas, recargos, descuentos y turnos · PDF</Text>
            </View>
            <Ionicons name="download-outline" size={18} color="#94A3B8" />
          </Pressable>

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
