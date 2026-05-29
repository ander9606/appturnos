/**
 * Detalle de turno — app/turno/[id].tsx
 *
 * CTA contextual por estado:
 *   confirmado  → GPS indicator + "Marcar Ingreso" (bloqueado si fuera de geofence)
 *   en_progreso → tiempo transcurrido + "Marcar Egreso" → abre SignaturePad
 *   completado  → resumen de horas y pago
 *   cancelado / no_presentado / pendiente → informativo
 */
import React, { useState, useMemo } from 'react';
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

import { Ionicons } from '@expo/vector-icons';

import { useAsignacion, useMarcarIngreso, useMarcarEgreso } from '@/features/turnos/useTurnos';
import { useGeofence }         from '@/features/turnos/useGeofence';
import { GeoFenceIndicator }   from '@/features/turnos/GeoFenceIndicator';
import { SignaturePad }        from '@/features/turnos/SignaturePad';
import { TurnoTimeline }       from '@/features/turnos/TurnoTimeline';
import { StarRating }          from '@/features/turnos/StarRating';
import { Badge }               from '@/components/ui/Badge';
import { Button }              from '@/components/ui/Button';
import { getEstadoConfig, fmtRange, fmtTime } from '@/features/turnos/turnosUtils';
import { ApiError }            from '@api-client';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

// ── Helpers ───────────────────────────────────────────────────────────────

function InfoRow({ icon, label, value }: { icon: IoniconsName; label: string; value: string }) {
  return (
    <View className="flex-row items-start gap-3 py-3 border-b border-border last:border-0">
      <View className="w-8 h-8 bg-muted rounded-xl items-center justify-center mt-0.5">
        <Ionicons name={icon} size={16} color="#64748B" />
      </View>
      <View className="flex-1 gap-0.5">
        <Text className="text-xs text-muted-foreground">{label}</Text>
        <Text className="text-sm font-medium text-foreground">{value}</Text>
      </View>
    </View>
  );
}

const SHORT_DAYS   = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const SHORT_MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
function fmtDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return `${SHORT_DAYS[d.getDay()]}, ${d.getDate()} de ${SHORT_MONTHS[d.getMonth()]}`;
}

// ── Screen ────────────────────────────────────────────────────────────────

export default function TurnoDetailScreen() {
  const { id: idParam } = useLocalSearchParams<{ id: string }>();
  const id = idParam ? parseInt(idParam, 10) : null;
  const router = useRouter();

  const [signatureVisible, setSignatureVisible] = useState(false);

  // ── Data ──────────────────────────────────────────────────────────────
  const { data: asignacion, isLoading } = useAsignacion(id);

  const ingresoMutation = useMarcarIngreso();
  const egresoMutation  = useMarcarEgreso();

  // ── Geofence ──────────────────────────────────────────────────────────
  const { distanceM, status: geoStatus, canMark, permissionDenied } = useGeofence({
    targetLat: asignacion?.latitud ?? null,
    targetLng: asignacion?.longitud ?? null,
    enabled: asignacion?.estado === 'confirmado',
  });

  // ── Derived ───────────────────────────────────────────────────────────
  const estadoConfig = useMemo(
    () => (asignacion ? getEstadoConfig(asignacion.estado) : null),
    [asignacion?.estado],
  );

  const elapsedLabel = useMemo(() => {
    if (!asignacion?.hora_ingreso_real) return null;
    const ingreso = new Date(asignacion.hora_ingreso_real).getTime();
    const diffMin = Math.floor((Date.now() - ingreso) / 60_000);
    const h = Math.floor(diffMin / 60);
    const m = diffMin % 60;
    return h > 0 ? `${h}h ${m}m en curso` : `${m}m en curso`;
  }, [asignacion?.hora_ingreso_real]);

  // ── Actions ───────────────────────────────────────────────────────────

  const handleIngreso = async () => {
    if (!asignacion || !canMark) return;

    const lat = asignacion.latitud ?? 0;
    const lng = asignacion.longitud ?? 0;

    try {
      await ingresoMutation.mutateAsync({ id: asignacion.id, lat, lng });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('✅ Ingreso registrado', 'Tu llegada ha sido confirmada.');
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'No se pudo registrar el ingreso.';
      Alert.alert('Error', msg);
    }
  };

  const handleEgreso = async (firmaBase64: string) => {
    if (!asignacion) return;
    try {
      await egresoMutation.mutateAsync({ id: asignacion.id, firma: firmaBase64 });
      setSignatureVisible(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('✅ Salida registrada', '¡Turno completado! Buen trabajo.');
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'No se pudo registrar la salida.';
      Alert.alert('Error', msg);
    }
  };

  // ── Loading / not found ───────────────────────────────────────────────

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
        <Text className="text-base font-semibold text-foreground text-center">
          Turno no encontrado
        </Text>
        <Button label="Volver" onPress={() => router.back()} variant="secondary" />
      </SafeAreaView>
    );
  }

  const { estado, oferta_titulo, oferta_fecha, hora_inicio, hora_fin_estimada,
          lugar, tarifa_dia, hora_ingreso_real, hora_egreso_real,
          horas_trabajadas, pago_total,
          calificacion, calificacion_comentario } = asignacion;

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <>
      {/* Configure back button title via Stack */}
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitle: oferta_titulo,
          headerTitleStyle: { fontWeight: '700', fontSize: 17 },
          headerBackTitle: 'Turnos',
          headerTintColor: '#FF5A3C',
          headerStyle: { backgroundColor: '#FFFFFF' },
          headerShadowVisible: true,
        }}
      />

      <SafeAreaView className="flex-1 bg-background" edges={['bottom']}>
        <ScrollView
          contentContainerClassName="px-5 py-5 gap-5 pb-10"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Hero card ─────────────────────────────────────── */}
          <View
            className="bg-card rounded-3xl overflow-hidden"
            style={{ elevation: 3, shadowColor: '#000', shadowOpacity: 0.07, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } }}
          >
            {/* Accent header */}
            <View
              className="h-2"
              style={{ backgroundColor: estadoConfig?.accentColor ?? '#E2E8F0' }}
            />

            <View className="px-5 py-5 gap-1">
              <View className="flex-row items-start justify-between">
                <Text className="text-xl font-bold text-foreground flex-1 pr-3" numberOfLines={2}>
                  {oferta_titulo}
                </Text>
                {estadoConfig && (
                  <Badge label={estadoConfig.label} variant={estadoConfig.badgeVariant} />
                )}
              </View>

              {/* Info rows */}
              <View className="mt-3">
                <InfoRow icon="calendar-outline" label="Fecha"   value={fmtDate(oferta_fecha)} />
                <InfoRow icon="time-outline"     label="Horario" value={fmtRange(hora_inicio, hora_fin_estimada)} />
                {lugar && <InfoRow icon="location-outline" label="Lugar" value={lugar} />}
                <InfoRow icon="cash-outline"     label="Tarifa"  value={`$${tarifa_dia.toLocaleString('es-CO')} / día`} />
              </View>
            </View>
          </View>

          {/* ── Timeline ──────────────────────────────────────── */}
          <View className="bg-card rounded-2xl px-5 py-5"
            style={{ elevation: 1, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8 }}
          >
            <Text className="text-sm font-semibold text-foreground mb-4">Progreso del turno</Text>
            <TurnoTimeline
              estado={estado}
              ingresoTime={hora_ingreso_real}
              egresoTime={hora_egreso_real}
            />
          </View>

          {/* ── Completado: resumen ────────────────────────────── */}
          {estado === 'completado' && (
            <>
              <View className="bg-success-light rounded-2xl px-5 py-5 gap-3">
                <View className="flex-row items-center gap-2">
                  <Ionicons name="checkmark-circle" size={26} color="#059669" />
                  <Text className="text-base font-bold text-success">¡Turno completado!</Text>
                </View>
                <View className="flex-row gap-4">
                  {horas_trabajadas != null && (
                    <View className="flex-1 bg-white/60 rounded-xl px-4 py-3">
                      <Text className="text-xs text-success/70">Horas trabajadas</Text>
                      <Text className="text-lg font-bold text-success">
                        {Number(horas_trabajadas).toFixed(1)}h
                      </Text>
                    </View>
                  )}
                  {pago_total != null && (
                    <View className="flex-1 bg-white/60 rounded-xl px-4 py-3">
                      <Text className="text-xs text-success/70">Pago total</Text>
                      <Text className="text-lg font-bold text-success">
                        ${Number(pago_total).toLocaleString('es-CO')}
                      </Text>
                    </View>
                  )}
                </View>
                <View className="flex-row items-center gap-2">
                  <Text className="text-xs text-success/80">Entrada:</Text>
                  <Text className="text-xs font-medium text-success">
                    {hora_ingreso_real ? fmtTime(hora_ingreso_real.slice(11, 19)) : '—'}
                  </Text>
                  <Text className="text-xs text-success/60 mx-1">·</Text>
                  <Text className="text-xs text-success/80">Salida:</Text>
                  <Text className="text-xs font-medium text-success">
                    {hora_egreso_real ? fmtTime(hora_egreso_real.slice(11, 19)) : '—'}
                  </Text>
                </View>
              </View>

              {/* Calificación recibida */}
              <View className="bg-card rounded-2xl px-5 py-4 border border-border">
                <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                  Calificación recibida
                </Text>
                {calificacion != null ? (
                  <View className="gap-2">
                    <StarRating mode="display" value={calificacion} size="lg" />
                    {calificacion_comentario != null && (
                      <Text className="text-sm text-foreground italic mt-1">
                        "{calificacion_comentario}"
                      </Text>
                    )}
                  </View>
                ) : (
                  <View className="flex-row items-center gap-2">
                    <StarRating mode="display" value={null} showEmpty size="md" />
                    <Text className="text-sm text-muted-foreground">Pendiente de calificación</Text>
                  </View>
                )}
              </View>
            </>
          )}

          {/* ── CTA: Marcar Ingreso (estado: confirmado) ────────── */}
          {estado === 'confirmado' && (
            <View className="gap-3">
              <GeoFenceIndicator
                distanceM={distanceM}
                status={geoStatus}
                permissionDenied={permissionDenied}
              />

              {!canMark && distanceM !== null && (
                <Text className="text-xs text-center text-muted-foreground px-4">
                  Acércate al punto de trabajo para habilitar el marcaje de entrada.
                </Text>
              )}

              <Button
                label={ingresoMutation.isPending ? 'Registrando ingreso…' : 'Marcar Ingreso'}
                variant="primary"
                size="lg"
                fullWidth
                loading={ingresoMutation.isPending}
                disabled={!canMark}
                onPress={handleIngreso}
              />
            </View>
          )}

          {/* ── CTA: En progreso → Marcar Egreso ────────────────── */}
          {estado === 'en_progreso' && (
            <View className="gap-3">
              {/* Elapsed time */}
              {elapsedLabel && (
                <View className="bg-success-light rounded-2xl px-4 py-3 flex-row items-center gap-3">
                  <View className="w-2.5 h-2.5 rounded-full bg-success" />
                  <View>
                    <Text className="text-sm font-semibold text-success">{elapsedLabel}</Text>
                    {hora_ingreso_real && (
                      <Text className="text-xs text-success/70 mt-0.5">
                        Ingreso registrado a las {fmtTime(hora_ingreso_real.slice(11, 19))}
                      </Text>
                    )}
                  </View>
                </View>
              )}

              <Button
                label="Marcar Salida"
                variant="primary"
                size="lg"
                fullWidth
                onPress={() => setSignatureVisible(true)}
              />
              <Text className="text-xs text-center text-muted-foreground">
                Se requiere firma digital para confirmar la salida.
              </Text>
            </View>
          )}

          {/* ── Pendiente: informativo ───────────────────────────── */}
          {estado === 'pendiente' && (
            <View className="bg-warning-light rounded-2xl px-4 py-4 flex-row items-center gap-3">
              <Ionicons name="hourglass-outline" size={26} color="#D97706" />
              <View className="flex-1">
                <Text className="text-sm font-semibold text-amber-700">
                  Esperando confirmación
                </Text>
                <Text className="text-xs text-amber-600 mt-0.5">
                  El responsable de turnos debe confirmar tu postulación.
                </Text>
              </View>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>

      {/* ── Signature modal ───────────────────────────────────── */}
      <SignaturePad
        visible={signatureVisible}
        onClose={() => setSignatureVisible(false)}
        onConfirm={handleEgreso}
        loading={egresoMutation.isPending}
      />
    </>
  );
}
