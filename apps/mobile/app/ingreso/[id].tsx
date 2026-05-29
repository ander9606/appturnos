/**
 * Marcar Ingreso — app/ingreso/[id].tsx
 *
 * Pantalla dedicada para registrar la entrada a un turno.
 * Muestra el estado del GPS/geofence y habilita el botón cuando
 * el trabajador está dentro del radio del lugar de trabajo.
 */
import React from 'react';
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { useAsignacion, useMarcarIngreso } from '@/features/turnos/useTurnos';
import { useGeofence }       from '@/features/turnos/useGeofence';
import { GeoFenceIndicator } from '@/features/turnos/GeoFenceIndicator';
import { Button }            from '@/components/ui/Button';
import { fmtRange }          from '@/features/turnos/turnosUtils';
import { ApiError }          from '@api-client';
import { t }                 from '@/lib/i18n';

// ── Helpers ───────────────────────────────────────────────────────────────

const SHORT_DAYS   = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const SHORT_MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

function fmtDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return `${SHORT_DAYS[d.getDay()]}, ${d.getDate()} de ${SHORT_MONTHS[d.getMonth()]}`;
}

// ── Screen ────────────────────────────────────────────────────────────────

export default function IngresoScreen() {
  const { id: idParam } = useLocalSearchParams<{ id: string }>();
  const id = idParam ? parseInt(idParam, 10) : null;
  const router = useRouter();

  const { data: asignacion, isLoading } = useAsignacion(id);
  const ingresoMutation = useMarcarIngreso();

  const { distanceM, status: geoStatus, canMark, permissionDenied } = useGeofence({
    targetLat: asignacion?.latitud ?? null,
    targetLng: asignacion?.longitud ?? null,
    enabled: asignacion?.estado === 'confirmado',
  });

  const handleIngreso = async () => {
    if (!asignacion || !canMark) return;
    try {
      await ingresoMutation.mutateAsync({
        id: asignacion.id,
        lat: asignacion.latitud ?? 0,
        lng: asignacion.longitud ?? 0,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        t('ingreso.success'),
        t('ingreso.successSub'),
        [{ text: 'OK', onPress: () => router.back() }],
      );
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'No se pudo registrar el ingreso.';
      Alert.alert('Error', msg);
    }
  };

  // ── Loading ───────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator size="large" color="#FF5A3C" />
      </SafeAreaView>
    );
  }

  if (!asignacion) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center gap-4 px-6">
        <Text className="text-4xl">🔍</Text>
        <Text className="text-base font-semibold text-foreground text-center">Turno no encontrado</Text>
        <Button label="Volver" onPress={() => router.back()} variant="secondary" />
      </SafeAreaView>
    );
  }

  if (asignacion.estado !== 'confirmado') {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center gap-4 px-6">
        <Text className="text-5xl">⚠️</Text>
        <Text className="text-base font-semibold text-foreground text-center">
          Este turno no está disponible para registrar ingreso
        </Text>
        <Text className="text-sm text-muted-foreground text-center">
          Estado actual: {asignacion.estado}
        </Text>
        <Button label="Volver" onPress={() => router.back()} variant="secondary" />
      </SafeAreaView>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitle: t('ingreso.title'),
          headerTitleStyle: { fontWeight: '700', fontSize: 17 },
          headerBackTitle: 'Turno',
          headerTintColor: '#FF5A3C',
          headerStyle: { backgroundColor: '#FFFFFF' },
          headerShadowVisible: true,
        }}
      />

      <SafeAreaView className="flex-1 bg-background" edges={['bottom']}>
        <ScrollView
          contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        >
          {/* ── Info del turno ──────────────────────────────────── */}
          <View className="bg-card rounded-2xl border border-border overflow-hidden"
            style={{ elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } }}
          >
            <View className="h-1.5 bg-primary" />
            <View className="px-5 py-5 gap-3">
              <Text className="text-xl font-bold text-foreground" numberOfLines={2}>
                {asignacion.oferta_titulo}
              </Text>

              <View className="flex-row gap-4">
                <View className="flex-1 bg-muted rounded-xl px-4 py-3">
                  <Text className="text-xs text-muted-foreground mb-0.5">Fecha</Text>
                  <Text className="text-sm font-semibold text-foreground">
                    {fmtDate(asignacion.oferta_fecha)}
                  </Text>
                </View>
                <View className="flex-1 bg-muted rounded-xl px-4 py-3">
                  <Text className="text-xs text-muted-foreground mb-0.5">Horario</Text>
                  <Text className="text-sm font-semibold text-foreground">
                    {fmtRange(asignacion.hora_inicio, asignacion.hora_fin_estimada)}
                  </Text>
                </View>
              </View>

              {asignacion.lugar && (
                <View className="flex-row items-center gap-2">
                  <Text className="text-base">📍</Text>
                  <Text className="text-sm text-muted-foreground flex-1" numberOfLines={2}>
                    {asignacion.lugar}
                  </Text>
                </View>
              )}

              <View className="flex-row items-center gap-2">
                <Text className="text-base">💰</Text>
                <Text className="text-sm font-semibold text-success">
                  ${asignacion.tarifa_dia.toLocaleString('es-CO')} / día
                </Text>
              </View>
            </View>
          </View>

          {/* ── GPS / Geofence ──────────────────────────────────── */}
          <View className="bg-card rounded-2xl border border-border px-5 py-5 gap-4"
            style={{ elevation: 1, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6 }}
          >
            <Text className="text-sm font-semibold text-foreground">{t('ingreso.ubicacion')}</Text>

            <GeoFenceIndicator
              distanceM={distanceM}
              status={geoStatus}
              permissionDenied={permissionDenied}
            />

            {distanceM !== null && asignacion.latitud && (
              <View className={`rounded-xl px-4 py-3 ${canMark ? 'bg-success/10' : 'bg-warning/10'}`}>
                <Text className={`text-sm font-semibold ${canMark ? 'text-success' : 'text-amber-600'}`}>
                  {canMark ? t('ingreso.dentroGeofence') : t('ingreso.fueraGeofence')}
                </Text>
                <Text className={`text-xs mt-0.5 ${canMark ? 'text-success/70' : 'text-amber-500'}`}>
                  {t('ingreso.distancia').replace('{{dist}}', String(Math.round(distanceM)))}
                </Text>
              </View>
            )}

            {permissionDenied && (
              <View className="bg-danger/10 rounded-xl px-4 py-3">
                <Text className="text-sm font-semibold text-danger">{t('ingreso.permisoGps')}</Text>
              </View>
            )}

            {!canMark && distanceM !== null && !permissionDenied && (
              <Text className="text-xs text-center text-muted-foreground">
                Acércate al punto de trabajo para habilitar el registro de entrada.
              </Text>
            )}
          </View>

          {/* ── CTA ─────────────────────────────────────────────── */}
          <Button
            label={ingresoMutation.isPending ? t('ingreso.marcando') : t('ingreso.marcar')}
            variant="primary"
            size="lg"
            fullWidth
            loading={ingresoMutation.isPending}
            disabled={!canMark}
            onPress={handleIngreso}
          />
        </ScrollView>
      </SafeAreaView>
    </>
  );
}
