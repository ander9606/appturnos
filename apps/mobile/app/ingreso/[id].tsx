/**
 * Marcar Ingreso — app/ingreso/[id].tsx
 *
 * Pantalla dedicada para registrar la entrada a un turno.
 * Muestra el estado del GPS/geofence y habilita el botón cuando
 * el trabajador está dentro del radio autorizado según el tipo de
 * geofence configurado en el cargo (oferta, fijo, zonal, libre).
 */
import React, { useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { Ionicons } from '@expo/vector-icons';

import { useAsignacion, useMarcarIngreso } from '@/features/turnos/useTurnos';
import { useGeofence, type GeofenceTarget } from '@/features/turnos/useGeofence';
import { GeoFenceIndicator }               from '@/features/turnos/GeoFenceIndicator';
import { Button }                          from '@/components/ui/Button';
import { fmtRange }                        from '@/features/turnos/turnosUtils';
import { ApiError, puntosMarcajeApi }      from '@api-client';
import type { PuntoMarcaje }               from '@api-client';
import { t }                               from '@/lib/i18n';

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

  // Fetch zonal puntos-marcaje only when geofence type is 'zonal'
  const isZonal = asignacion?.geofence_info?.tipo === 'zonal';
  const { data: zonalPuntos } = useQuery<PuntoMarcaje[]>({
    queryKey: ['puntos-marcaje'],
    queryFn:  () => puntosMarcajeApi.listar(),
    enabled:  isZonal && asignacion?.estado === 'confirmado',
    staleTime: 5 * 60_000,
  });

  // Resolve geofence targets from geofence_info
  const geofenceTargets = useMemo<GeofenceTarget[] | null>(() => {
    const gf = asignacion?.geofence_info;
    if (!gf) return null;

    switch (gf.tipo) {
      case 'libre':
        return null; // no restriction

      case 'fijo':
        if (gf.latitud == null) return null;
        return [{ lat: gf.latitud, lng: gf.longitud, radiusM: gf.radio_metros }];

      case 'oferta':
        if (gf.latitud == null) return null;
        return [{ lat: gf.latitud, lng: gf.longitud, radiusM: gf.radio_metros }];

      case 'zonal':
        if (!zonalPuntos?.length) return null;
        return (zonalPuntos as PuntoMarcaje[])
          .filter((p: PuntoMarcaje) => p.tipo === 'zonal' && Boolean(p.activo))
          .map((p: PuntoMarcaje) => ({ lat: Number(p.latitud), lng: Number(p.longitud), radiusM: p.radio_metros }));

      default:
        return null;
    }
  }, [asignacion?.geofence_info, zonalPuntos]);

  const { distanceM, status: geoStatus, canMark, permissionDenied, currentLocation } = useGeofence({
    targets: geofenceTargets,
    enabled: asignacion?.estado === 'confirmado',
  });

  const handleIngreso = async () => {
    if (!asignacion || !canMark) return;
    try {
      await ingresoMutation.mutateAsync({
        id: asignacion.id,
        lat: currentLocation?.lat ?? 0,
        lng: currentLocation?.lng ?? 0,
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
        <Ionicons name="search-outline" size={48} color="#94A3B8" />
        <Text className="text-base font-semibold text-foreground text-center">Turno no encontrado</Text>
        <Button label="Volver" onPress={() => router.back()} variant="secondary" />
      </SafeAreaView>
    );
  }

  if (asignacion.estado !== 'confirmado') {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center gap-4 px-6">
        <Ionicons name="warning-outline" size={52} color="#F59E0B" />
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

  const isLibre  = asignacion.geofence_info?.tipo === 'libre';
  const hasCoords = geofenceTargets !== null && geofenceTargets.length > 0;

  // Location label shown in the geofence card
  const locationLabel = (() => {
    const gf = asignacion.geofence_info;
    if (!gf) return asignacion.lugar;
    if (gf.tipo === 'fijo')   return (gf as { nombre: string }).nombre;
    if (gf.tipo === 'oferta') return asignacion.lugar;
    if (gf.tipo === 'zonal')  return 'Puntos zonales autorizados';
    return null;
  })();

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
          <View
            className="bg-card rounded-2xl border border-border overflow-hidden"
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

              {locationLabel && (
                <View className="flex-row items-center gap-2">
                  <Ionicons name="location-outline" size={16} color="#64748B" />
                  <Text className="text-sm text-muted-foreground flex-1" numberOfLines={2}>
                    {locationLabel}
                  </Text>
                </View>
              )}

              <View className="flex-row items-center gap-2">
                <Ionicons name="cash-outline" size={16} color="#059669" />
                <Text className="text-sm font-semibold text-success">
                  ${asignacion.tarifa_dia.toLocaleString('es-CO')} / día
                </Text>
              </View>
            </View>
          </View>

          {/* ── GPS / Geofence ──────────────────────────────────── */}
          {isLibre ? (
            <View className="bg-success/10 rounded-2xl border border-success/20 px-5 py-4">
              <Text className="text-sm font-semibold text-success">Sin restricción de ubicación</Text>
              <Text className="text-xs text-success/70 mt-0.5">
                Este cargo permite marcar desde cualquier lugar.
              </Text>
            </View>
          ) : (
            <View
              className="bg-card rounded-2xl border border-border px-5 py-5 gap-4"
              style={{ elevation: 1, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6 }}
            >
              <Text className="text-sm font-semibold text-foreground">{t('ingreso.ubicacion')}</Text>

              <GeoFenceIndicator
                distanceM={distanceM}
                status={geoStatus}
                permissionDenied={permissionDenied}
              />

              {distanceM !== null && hasCoords && (
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
                  {isZonal
                    ? 'Acércate a uno de los puntos zonales autorizados.'
                    : 'Acércate al punto de trabajo para habilitar el registro de entrada.'}
                </Text>
              )}
            </View>
          )}

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
