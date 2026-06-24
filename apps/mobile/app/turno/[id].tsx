/**
 * Detalle de turno — app/turno/[id].tsx
 *
 * CTA contextual por estado:
 *   confirmado  → GPS indicator + "Marcar Ingreso" (bloqueado si fuera de geofence)
 *   en_progreso → tiempo transcurrido en vivo + "Marcar Egreso" → abre SignaturePad
 *   completado  → resumen de horas y pago
 *   cancelado / no_presentado / pendiente → informativo
 */
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';

import { useTheme }            from '@/lib/theme';
import { useAuthStore }        from '@/features/auth/useAuthStore';
import { useNovedades }        from '@/features/novedades/useNovedades';
import { NovedadCard }         from '@/features/novedades/NovedadCard';
import { ReportarNovedadModal } from '@/features/novedades/ReportarNovedadModal';
import { useAsignacion, useMarcarIngreso, useMarcarEgreso, useCalificar } from '@/features/turnos/useTurnos';
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

/** Convierte minutos restantes en etiqueta legible: "1h 23m", "45 min". */
function fmtFaltan(min: number): string {
  const m = Math.max(1, Math.ceil(min));
  const h = Math.floor(m / 60);
  const rem = m % 60;
  if (h > 0 && rem > 0) return `${h}h ${rem}m`;
  if (h > 0) return `${h}h`;
  return `${rem} min`;
}

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
  const theme  = useTheme();

  const [signatureVisible, setSignatureVisible] = useState(false);
  const [novedadModalVisible, setNovedadModalVisible] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [selectedRating, setSelectedRating] = useState(0);
  const [comentario, setComentario] = useState('');

  const rol = useAuthStore((s) => s.usuario?.rol);
  const isGestor = rol === 'jefe_turnos' || rol === 'admin_empresa';

  // ── Data ──────────────────────────────────────────────────────────────
  const { data: asignacion, isLoading } = useAsignacion(id);
  const { data: novedades = [] } = useNovedades(id);

  const ingresoMutation    = useMarcarIngreso();
  const egresoMutation     = useMarcarEgreso();
  const calificarMutation  = useCalificar();

  // ── Live timer: elapsed (en_progreso) + countdown (confirmado) ───────
  useEffect(() => {
    if (asignacion?.estado !== 'en_progreso' && asignacion?.estado !== 'confirmado') return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [asignacion?.estado]);

  // ── Geofence targets from geofence_info ───────────────────────────────
  const geofenceTargets = useMemo(() => {
    const gf = asignacion?.geofence_info;
    if (!gf) return null;
    if (gf.tipo === 'libre' || gf.tipo === 'zonal') return null;
    if (gf.latitud != null && gf.longitud != null) {
      return [{ lat: gf.latitud, lng: gf.longitud, radiusM: gf.radio_metros }];
    }
    return null;
  }, [asignacion?.geofence_info]);

  const { distanceM, status: geoStatus, canMark, permissionDenied, currentLocation } = useGeofence({
    targets: geofenceTargets,
    enabled: asignacion?.estado === 'confirmado',
  });

  // ── Ventana de ingreso: habilitado 30 min antes del hora_inicio ──────
  const WINDOW_MIN = 30;

  const minutosParaIngreso = useMemo(() => {
    if (asignacion?.estado !== 'confirmado') return null;
    const { oferta_fecha, hora_inicio } = asignacion;
    const scheduled = new Date(`${oferta_fecha}T${hora_inicio}`).getTime();
    return Math.ceil((scheduled - now) / 60_000);
  }, [asignacion?.estado, asignacion?.oferta_fecha, asignacion?.hora_inicio, now]);

  // true once we're within WINDOW_MIN minutes of (or past) the scheduled start
  const dentroVentana = minutosParaIngreso === null || minutosParaIngreso <= WINDOW_MIN;

  // ── Derived ───────────────────────────────────────────────────────────
  const estadoConfig = useMemo(
    () => (asignacion ? getEstadoConfig(asignacion.estado) : null),
    [asignacion?.estado],
  );

  const elapsedLabel = useMemo(() => {
    if (!asignacion?.hora_ingreso_real) return null;
    const ingreso = new Date(asignacion.hora_ingreso_real).getTime();
    const totalSec = Math.floor((now - ingreso) / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  }, [asignacion?.hora_ingreso_real, now]);

  // ── Actions ───────────────────────────────────────────────────────────

  const handleIngresoPronto = useCallback(() => {
    if (minutosParaIngreso === null) return;
    const min = Math.max(1, minutosParaIngreso);
    const h = Math.floor(min / 60);
    const m = min % 60;
    const label = h > 0 && m > 0 ? `${h}h ${m}m`
                : h > 0            ? `${h}h`
                :                    `${m} min`;
    Alert.alert(
      'Muy pronto',
      `Falta ${label} para el ingreso.\nEl marcaje se habilita 30 min antes de la hora de entrada.`,
      [{ text: 'Entendido', style: 'cancel' }],
    );
  }, [minutosParaIngreso]);

  const handleIngreso = async () => {
    if (!asignacion || !canMark) return;
    const lat = currentLocation?.lat ?? 0;
    const lng = currentLocation?.lng ?? 0;

    try {
      await ingresoMutation.mutateAsync({ id: asignacion.id, lat, lng });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Ingreso registrado', 'Tu llegada ha sido confirmada.');
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
      Alert.alert('Salida registrada', '¡Turno completado! Buen trabajo.');
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'No se pudo registrar la salida.';
      Alert.alert('Error', msg);
    }
  };

  const handleCalificar = async () => {
    if (!asignacion || selectedRating === 0) return;
    try {
      await calificarMutation.mutateAsync({
        id: asignacion.id,
        calificacion: selectedRating,
        comentario: comentario.trim() || undefined,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Calificación guardada', '');
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'No se pudo guardar la calificación.';
      Alert.alert('Error', msg);
    }
  };

  const openInMaps = useCallback(() => {
    const lat = asignacion?.latitud;
    const lng = asignacion?.longitud;
    if (lat == null || lng == null) return;
    const label = encodeURIComponent(asignacion?.lugar ?? 'Turno');
    const url = Platform.select({
      ios:     `maps://app?q=${label}&ll=${lat},${lng}`,
      android: `geo:${lat},${lng}?q=${lat},${lng}(${label})`,
    }) ?? `https://maps.google.com/?q=${lat},${lng}`;
    Linking.openURL(url).catch(() =>
      Linking.openURL(`https://maps.google.com/?q=${lat},${lng}`)
    );
  }, [asignacion?.latitud, asignacion?.longitud, asignacion?.lugar]);

  // ── Loading / not found ───────────────────────────────────────────────

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator size="large" color={theme.primary} />
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
          calificacion, calificacion_comentario,
          oferta_descripcion, oferta_externo_notas } = asignacion;

  const hasMapCoords = asignacion.latitud != null && asignacion.longitud != null;

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitle: oferta_titulo,
          headerTitleStyle: { fontWeight: '700', fontSize: 17 },
          headerBackTitle: 'Turnos',
          headerTintColor: theme.primary,
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

              <View className="mt-3">
                <InfoRow icon="calendar-outline" label="Fecha"   value={fmtDate(oferta_fecha)} />
                <InfoRow icon="time-outline"     label="Horario" value={fmtRange(hora_inicio, hora_fin_estimada)} />

                {/* Location row with Google Maps button */}
                {lugar && (
                  <View className="flex-row items-start gap-3 py-3 border-b border-border">
                    <View className="w-8 h-8 bg-muted rounded-xl items-center justify-center mt-0.5">
                      <Ionicons name="location-outline" size={16} color="#64748B" />
                    </View>
                    <View className="flex-1 gap-0.5">
                      <Text className="text-xs text-muted-foreground">Lugar</Text>
                      <Text className="text-sm font-medium text-foreground">{lugar}</Text>
                    </View>
                    {hasMapCoords && (
                      <TouchableOpacity
                        onPress={openInMaps}
                        className="flex-row items-center gap-1.5 px-3 py-1.5 rounded-xl bg-muted mt-0.5"
                        accessibilityLabel="Ver en Google Maps"
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Ionicons name="map-outline" size={14} color="#3B82F6" />
                        <Text className="text-xs font-semibold text-info">Mapa</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}

                <InfoRow icon="cash-outline" label="Tarifa" value={`$${tarifa_dia.toLocaleString('es-CO')} / turno`} />
              </View>
            </View>
          </View>

          {/* ── Descripción del turno (productos + equipo nómina) ─ */}
          {(oferta_descripcion || oferta_externo_notas) && (
            <View
              className="bg-card rounded-2xl px-5 py-4 gap-3"
              style={{ elevation: 1, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8 }}
            >
              {oferta_descripcion && (
                <View className="gap-1">
                  <View className="flex-row items-center gap-2">
                    <Ionicons name="cube-outline" size={14} color="#64748B" />
                    <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Material a instalar
                    </Text>
                  </View>
                  <Text className="text-sm text-foreground leading-5 pl-5">{oferta_descripcion}</Text>
                </View>
              )}
              {oferta_descripcion && oferta_externo_notas && (
                <View className="border-t border-border" />
              )}
              {oferta_externo_notas && (
                <View className="gap-1">
                  <View className="flex-row items-center gap-2">
                    <Ionicons name="people-outline" size={14} color="#64748B" />
                    <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Equipo del cliente
                    </Text>
                  </View>
                  <Text className="text-sm text-foreground leading-5 pl-5">{oferta_externo_notas}</Text>
                </View>
              )}
            </View>
          )}

          {/* ── Timeline ──────────────────────────────────────── */}
          <View
            className="bg-card rounded-2xl px-5 py-5"
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
                  {pago_total != null && (
                    <View className="flex-1 bg-white/60 rounded-xl px-4 py-3">
                      <Text className="text-xs text-success/70">Pago del turno</Text>
                      <Text className="text-lg font-bold text-success">
                        ${Number(pago_total).toLocaleString('es-CO')}
                      </Text>
                    </View>
                  )}
                  {horas_trabajadas != null && (
                    <View className="flex-1 bg-white/60 rounded-xl px-4 py-3">
                      <Text className="text-xs text-success/70">Horas en sitio</Text>
                      <Text className="text-lg font-bold text-success">
                        {Number(horas_trabajadas).toFixed(1)}h
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

              {/* Calificación */}
              <View className="bg-card rounded-2xl px-5 py-4 border border-border">
                <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                  Calificación
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
                ) : isGestor ? (
                  <View className="gap-3">
                    <StarRating mode="input" value={selectedRating} onChange={setSelectedRating} size="lg" />
                    <TextInput
                      placeholder="Comentario (opcional)"
                      value={comentario}
                      onChangeText={setComentario}
                      className="text-sm text-foreground border border-border rounded-xl px-3 py-2.5"
                      placeholderTextColor="#94A3B8"
                      maxLength={500}
                      multiline
                    />
                    <Button
                      label={calificarMutation.isPending ? 'Guardando…' : 'Guardar calificación'}
                      variant="primary"
                      fullWidth
                      loading={calificarMutation.isPending}
                      disabled={selectedRating === 0 || calificarMutation.isPending}
                      onPress={handleCalificar}
                    />
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

          {/* ── CTA: Marcar Ingreso (estado: confirmado) ─────────────────── */}
          {estado === 'confirmado' && (
            <View
              className="bg-card rounded-2xl px-5 py-5 gap-4"
              style={{ elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8 }}
            >
              <Text className="text-sm font-semibold text-foreground">Marcar llegada</Text>

              {/* Countdown — visible mientras falte más de 30 min */}
              {!dentroVentana && minutosParaIngreso !== null && (
                <View className="flex-row items-center gap-2.5 bg-muted rounded-xl px-3 py-3">
                  <Ionicons name="time-outline" size={18} color="#64748B" />
                  <View className="flex-1">
                    <Text className="text-xs text-muted-foreground">El marcaje se habilita en</Text>
                    <Text className="text-base font-bold text-foreground tabular-nums">
                      {fmtFaltan(minutosParaIngreso - WINDOW_MIN)}
                    </Text>
                  </View>
                </View>
              )}

              <GeoFenceIndicator
                distanceM={distanceM}
                status={geoStatus}
                permissionDenied={permissionDenied}
              />

              {dentroVentana && !canMark && distanceM !== null && (
                <View className="flex-row items-start gap-2">
                  <Ionicons name="information-circle-outline" size={16} color="#64748B" style={{ marginTop: 1 }} />
                  <Text className="flex-1 text-xs text-muted-foreground">
                    Acércate al punto de trabajo para habilitar el marcaje de entrada.
                  </Text>
                </View>
              )}

              <Button
                label={ingresoMutation.isPending ? 'Registrando ingreso…' : 'Marcar Ingreso'}
                variant="primary"
                size="lg"
                fullWidth
                loading={ingresoMutation.isPending}
                disabled={!dentroVentana || !canMark}
                onPress={handleIngreso}
                onPressDisabled={!dentroVentana ? handleIngresoPronto : undefined}
              />
            </View>
          )}

          {/* ── CTA: En progreso → Marcar Egreso ────────────────────────── */}
          {estado === 'en_progreso' && (
            <View
              className="bg-card rounded-2xl px-5 py-5 gap-4"
              style={{ elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8 }}
            >
              <Text className="text-sm font-semibold text-foreground">Turno en curso</Text>

              {/* Live elapsed time */}
              <View className="bg-success-light rounded-2xl px-4 py-4 items-center gap-1">
                <View className="flex-row items-center gap-2 mb-1">
                  <View className="w-2 h-2 rounded-full bg-success" />
                  <Text className="text-xs font-medium text-success uppercase tracking-wide">
                    Tiempo transcurrido
                  </Text>
                </View>
                <Text className="text-3xl font-bold text-success tabular-nums">
                  {elapsedLabel ?? '—'}
                </Text>
                {hora_ingreso_real && (
                  <Text className="text-xs text-success/70 mt-1">
                    Ingreso registrado a las {fmtTime(hora_ingreso_real.slice(11, 19))}
                  </Text>
                )}
              </View>

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

          {/* ── Novedades ─────────────────────────────────────── */}
          <View
            className="bg-card rounded-2xl px-5 py-4"
            style={{ elevation: 1, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8 }}
          >
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-sm font-semibold text-foreground">Novedades</Text>
              <TouchableOpacity
                onPress={() => setNovedadModalVisible(true)}
                className="flex-row items-center gap-1.5 px-3 py-1.5 bg-muted rounded-xl"
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="add" size={16} color="#0284C7" />
                <Text className="text-xs font-semibold text-info">Reportar</Text>
              </TouchableOpacity>
            </View>
            {novedades.length === 0 ? (
              <Text className="text-sm text-muted-foreground">Sin novedades reportadas.</Text>
            ) : (
              novedades.map((n) => <NovedadCard key={n.id} novedad={n} />)
            )}
          </View>
        </ScrollView>
      </SafeAreaView>

      {/* ── Signature modal ───────────────────────────────────── */}
      <SignaturePad
        visible={signatureVisible}
        onClose={() => setSignatureVisible(false)}
        onConfirm={handleEgreso}
        loading={egresoMutation.isPending}
      />

      {/* ── Novedad modal ─────────────────────────────────────── */}
      {id != null && (
        <ReportarNovedadModal
          visible={novedadModalVisible}
          asignacionId={id}
          onClose={() => setNovedadModalVisible(false)}
        />
      )}
    </>
  );
}
