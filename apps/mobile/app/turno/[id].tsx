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
  ScrollView,
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import * as WebBrowser from 'expo-web-browser';
import { Ionicons } from '@expo/vector-icons';

import { useTheme }            from '@/lib/theme';
import { useAuthStore }        from '@/features/auth/useAuthStore';
import { useNovedades }        from '@/features/novedades/useNovedades';
import { ReportarNovedadModal } from '@/features/novedades/ReportarNovedadModal';
import { useAsignacion, useMarcarIngreso, useMarcarEgreso, useCalificar } from '@/features/turnos/useTurnos';
import { useGeofence, type GeofenceTarget } from '@/features/turnos/useGeofence';
import { SignaturePad }        from '@/features/turnos/SignaturePad';
import { TurnoTimeline }       from '@/features/turnos/TurnoTimeline';
import { Button }              from '@/components/ui/Button';
import { getEstadoConfig } from '@/features/turnos/turnosUtils';
import { ApiError, puntosMarcajeApi, type PuntoParaTurno } from '@api-client';
import { webSafeSecureStore as SecureStore } from '@/lib/secureStore';
import { showToast }           from '@/lib/toast';
import { obtenerUbicacionActual } from '@/lib/currentLocation';

import { TurnoHeroCard }        from '@/features/turnos/detalle/TurnoHeroCard';
import { TurnoDescripcionCard } from '@/features/turnos/detalle/TurnoDescripcionCard';
import { TurnoUbicacionMarcada } from '@/features/turnos/detalle/TurnoUbicacionMarcada';
import { TurnoCompletadoCard }  from '@/features/turnos/detalle/TurnoCompletadoCard';
import { CalificacionCard }     from '@/features/turnos/detalle/CalificacionCard';
import { CTAConfirmadoCard }    from '@/features/turnos/detalle/CTAConfirmadoCard';
import { CTAEnProgresoCard }    from '@/features/turnos/detalle/CTAEnProgresoCard';
import { NovedadesCard }        from '@/features/turnos/detalle/NovedadesCard';
import { CorregirIngresoEgresoModal } from '@/features/turnos/detalle/CorregirIngresoEgresoModal';
import { BonoModal }            from '@/features/turnos/detalle/BonoModal';

export default function TurnoDetailScreen() {
  const { id: idParam } = useLocalSearchParams<{ id: string }>();
  const id = idParam ? parseInt(idParam, 10) : null;
  const router = useRouter();
  const theme  = useTheme();
  const qc = useQueryClient();

  const [signatureVisible, setSignatureVisible] = useState(false);
  const [novedadModalVisible, setNovedadModalVisible] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [selectedRating, setSelectedRating] = useState(0);
  const [comentario, setComentario] = useState('');
  const [cargandoContrato, setCargandoContrato] = useState(false);
  const [corrigiendoIngreso, setCorrigiendoIngreso] = useState(false);
  const [editandoBono, setEditandoBono] = useState(false);

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
  // Activo durante 'confirmado' (para el ingreso) y 'en_progreso' (para el
  // egreso) — antes solo cubría 'confirmado', así que al llegar a en_progreso
  // el poll se apagaba y el egreso nunca tenía una ubicación fresca.
  const activoParaGeofence = asignacion?.estado === 'confirmado' || asignacion?.estado === 'en_progreso';
  const isLibre = asignacion?.geofence_info?.tipo === 'libre';
  const isZonal = asignacion?.geofence_info?.tipo === 'zonal';

  // El servidor ya resuelve el set correcto (acotado al turno si el gestor
  // eligió zonas específicas, o todos los puntos zonales de la empresa si
  // no) — ver PuntosMarcajeModel.listarZonalesEfectivos.
  const { data: zonalPuntos } = useQuery<PuntoParaTurno[]>({
    queryKey: ['puntos-marcaje', 'zonales', asignacion?.oferta_id],
    queryFn:  () => puntosMarcajeApi.listarZonales(asignacion?.oferta_id),
    enabled:  isZonal && activoParaGeofence && asignacion?.oferta_id != null,
    staleTime: 5 * 60_000,
  });

  const geofenceTargets = useMemo<GeofenceTarget[] | null>(() => {
    const gf = asignacion?.geofence_info;
    if (!gf) return null;
    switch (gf.tipo) {
      case 'libre':
        return null;
      case 'fijo':
        if (gf.latitud == null) return null;
        return [{ lat: gf.latitud, lng: gf.longitud, radiusM: gf.radio_metros }];
      case 'oferta':
        if (gf.latitud == null || gf.longitud == null) return null;
        return [{ lat: gf.latitud, lng: gf.longitud, radiusM: gf.radio_metros }];
      case 'zonal':
        if (!zonalPuntos?.length) return null;
        return zonalPuntos.map((p) => ({ lat: p.latitud, lng: p.longitud, radiusM: p.radio_metros }));
      default:
        return null;
    }
  }, [asignacion?.geofence_info, zonalPuntos]);

  const { distanceM, status: geoStatus, canMark, permissionDenied, locationUnavailable, currentLocation } = useGeofence({
    targets: geofenceTargets,
    enabled: activoParaGeofence,
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

  // Geofence 'libre' no tiene targets, así que useGeofence nunca hace polling
  // y currentLocation queda en null — best-effort, nunca bloquea si falla o el
  // permiso está negado (ver obtenerUbicacionActual).
  async function ubicacionParaMarcaje() {
    if (currentLocation) return currentLocation;
    if (geofenceTargets !== null) return null; // hay geofence real: solo vale el fix vigilado por useGeofence
    const u = await obtenerUbicacionActual();
    return u.latitud != null && u.longitud != null ? { lat: u.latitud, lng: u.longitud } : null;
  }

  const handleIngreso = async () => {
    if (!asignacion || !canMark) return;
    const ubicacion = await ubicacionParaMarcaje();

    try {
      await ingresoMutation.mutateAsync({ id: asignacion.id, lat: ubicacion?.lat, lng: ubicacion?.lng });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showToast('Ingreso registrado — tu llegada ha sido confirmada.');
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'No se pudo registrar el ingreso.';
      Alert.alert('Error', msg);
    }
  };

  const handleEgreso = async (firmaBase64: string) => {
    if (!asignacion || !canMark) return;
    const ubicacion = await ubicacionParaMarcaje();

    try {
      await egresoMutation.mutateAsync({ id: asignacion.id, firma: firmaBase64, lat: ubicacion?.lat, lng: ubicacion?.lng });
      setSignatureVisible(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showToast('Salida registrada — ¡turno completado, buen trabajo!');
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
      showToast('Calificación guardada.');
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'No se pudo guardar la calificación.';
      Alert.alert('Error', msg);
    }
  };

  const handleDescargarContrato = async () => {
    if (!id) return;
    setCargandoContrato(true);
    try {
      const token = await SecureStore.getItemAsync('appturnos.access_token');
      const base  = process.env.EXPO_PUBLIC_API_URL;
      await WebBrowser.openBrowserAsync(`${base}/api/contratos/asignacion/${id}/pdf?token=${token}`);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'No se pudo abrir el contrato.';
      Alert.alert('Error', msg);
    } finally {
      setCargandoContrato(false);
    }
  };

  const handleIrAMisContratos = useCallback(() => {
    router.push('/mis-contratos?pendientes=1');
  }, [router]);

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

  const { estado, oferta_titulo, oferta_descripcion, oferta_externo_notas,
          hora_ingreso_real, hora_egreso_real,
          bono_monto, calificacion, calificacion_comentario } = asignacion;

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitle: oferta_titulo,
          headerTitleStyle: { fontWeight: '700', fontSize: 17 },
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
          <TurnoHeroCard
            asignacion={asignacion}
            estadoConfig={estadoConfig}
            isGestor={isGestor}
            onOpenMaps={openInMaps}
          />

          <TurnoDescripcionCard descripcion={oferta_descripcion} notasExterno={oferta_externo_notas} />

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

          <TurnoUbicacionMarcada asignacion={asignacion} />

          {/* ── Completado: resumen ────────────────────────────── */}
          {estado === 'completado' && (
            <>
              <TurnoCompletadoCard
                asignacion={asignacion}
                isGestor={isGestor}
                cargandoContrato={cargandoContrato}
                onDescargarContrato={handleDescargarContrato}
                onCorregir={() => setCorrigiendoIngreso(true)}
                onIrAMisContratos={handleIrAMisContratos}
              />

              <CalificacionCard
                calificacion={calificacion}
                calificacionComentario={calificacion_comentario}
                isGestor={isGestor}
                selectedRating={selectedRating}
                onRatingChange={setSelectedRating}
                comentario={comentario}
                onComentarioChange={setComentario}
                onGuardar={handleCalificar}
                guardando={calificarMutation.isPending}
              />
            </>
          )}

          {/* ── CTA: Marcar Ingreso (estado: confirmado) ─────────────────── */}
          {estado === 'confirmado' && (
            <CTAConfirmadoCard
              dentroVentana={dentroVentana}
              minutosParaIngreso={minutosParaIngreso}
              windowMin={WINDOW_MIN}
              isLibre={isLibre}
              distanceM={distanceM}
              geoStatus={geoStatus}
              canMark={canMark}
              permissionDenied={permissionDenied}
              locationUnavailable={locationUnavailable}
              ingresando={ingresoMutation.isPending}
              onIngreso={handleIngreso}
              onIngresoPronto={handleIngresoPronto}
            />
          )}

          {/* ── CTA: En progreso → Marcar Egreso ────────────────────────── */}
          {estado === 'en_progreso' && (
            <CTAEnProgresoCard
              elapsedLabel={elapsedLabel}
              horaIngresoReal={hora_ingreso_real}
              isLibre={isLibre}
              distanceM={distanceM}
              geoStatus={geoStatus}
              canMark={canMark}
              permissionDenied={permissionDenied}
              locationUnavailable={locationUnavailable}
              onMarcarSalida={() => setSignatureVisible(true)}
              isGestor={isGestor}
              onCorregir={() => setCorrigiendoIngreso(true)}
            />
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

          {/* ── Gestor: Corregir horario (siempre disponible) ─────────────── */}
          {isGestor && (
            <Button
              label="Corregir horario de entrada/salida"
              variant="secondary"
              size="md"
              fullWidth
              onPress={() => setCorrigiendoIngreso(true)}
            />
          )}

          {/* ── Gestor: Agregar/editar bono extra — solo turnos confirmados, en
              progreso o completados (nunca cancelados/no-presentados/pendientes).
              Si el contrato ya fue firmado, el backend revierte la firma y
              pide al trabajador refirmar con el nuevo monto (ver aviso en
              BonoModal) en vez de bloquear el cambio — el contrato se
              autofirma al marcar salida, así que bloquear por firma lo
              dejaba casi inutilizable. Mismo criterio que la versión web
              (OfertaDetailPage.tsx). ── */}
          {isGestor
            && (estado === 'confirmado' || estado === 'en_progreso' || estado === 'completado') && (
            <Button
              label={Number(bono_monto) > 0 ? 'Editar bono extra' : 'Agregar bono extra'}
              variant="secondary"
              size="md"
              fullWidth
              onPress={() => setEditandoBono(true)}
            />
          )}

          <NovedadesCard novedades={novedades} onReportar={() => setNovedadModalVisible(true)} />
        </ScrollView>
      </SafeAreaView>

      {/* ── Signature modal (egreso) ─────────────────────────── */}
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

      {/* ── Corregir ingreso/egreso modal ─────────────────────── */}
      {id != null && (
        <CorregirIngresoEgresoModal
          visible={corrigiendoIngreso}
          asignacion={asignacion}
          onClose={() => setCorrigiendoIngreso(false)}
        />
      )}

      {/* ── Bono extra modal ───────────────────────────────────── */}
      {id != null && (
        <BonoModal
          visible={editandoBono}
          asignacion={asignacion}
          onClose={() => setEditandoBono(false)}
        />
      )}
    </>
  );
}
