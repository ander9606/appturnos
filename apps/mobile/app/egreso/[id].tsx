/**
 * Marcar Egreso — app/egreso/[id].tsx
 *
 * Pantalla dedicada para registrar la salida de un turno.
 * Muestra el tiempo transcurrido desde el ingreso y captura
 * la firma digital para confirmar la salida.
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

import { useAsignacion, useMarcarEgreso } from '@/features/turnos/useTurnos';
import { SignaturePad }  from '@/features/turnos/SignaturePad';
import { Button }        from '@/components/ui/Button';
import { fmtRange, fmtTime } from '@/features/turnos/turnosUtils';
import { ApiError }      from '@api-client';
import { t }             from '@/lib/i18n';
import { showToast }     from '@/lib/toast';

// ── Helpers ───────────────────────────────────────────────────────────────

const SHORT_DAYS   = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const SHORT_MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

function fmtDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return `${SHORT_DAYS[d.getDay()]}, ${d.getDate()} de ${SHORT_MONTHS[d.getMonth()]}`;
}

function calcElapsed(ingresoIso: string): string {
  const ingreso = new Date(ingresoIso).getTime();
  const diffMin = Math.floor((Date.now() - ingreso) / 60_000);
  const h = Math.floor(diffMin / 60);
  const m = diffMin % 60;
  if (h > 0) return `${h}h ${m}min en curso`;
  return `${m}min en curso`;
}

// ── Screen ────────────────────────────────────────────────────────────────

export default function EgresoScreen() {
  const { id: idParam } = useLocalSearchParams<{ id: string }>();
  const id = idParam ? parseInt(idParam, 10) : null;
  const router = useRouter();

  const [signatureVisible, setSignatureVisible] = useState(false);

  const { data: asignacion, isLoading } = useAsignacion(id);
  const egresoMutation = useMarcarEgreso();

  const elapsedLabel = useMemo(() => {
    if (!asignacion?.hora_ingreso_real) return null;
    return calcElapsed(asignacion.hora_ingreso_real);
  }, [asignacion?.hora_ingreso_real]);

  const handleEgreso = async (firmaBase64: string) => {
    if (!asignacion) return;
    try {
      await egresoMutation.mutateAsync({ id: asignacion.id, firma: firmaBase64 });
      setSignatureVisible(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showToast(t('egreso.success'));
      router.back();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'No se pudo registrar la salida.';
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

  if (asignacion.estado !== 'en_progreso') {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center gap-4 px-6">
        <Ionicons name="warning-outline" size={52} color="#F59E0B" />
        <Text className="text-base font-semibold text-foreground text-center">
          Debes registrar el ingreso antes de marcar la salida
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
          headerTitle: t('egreso.title'),
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
            <View className="h-1.5 bg-success" />
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
                  <Ionicons name="location-outline" size={16} color="#64748B" />
                  <Text className="text-sm text-muted-foreground flex-1" numberOfLines={1}>
                    {asignacion.lugar}
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* ── Tiempo en curso ─────────────────────────────────── */}
          {elapsedLabel && (
            <View className="bg-success/10 rounded-2xl border border-success/20 px-5 py-5 gap-3">
              <View className="flex-row items-center gap-3">
                <View className="w-3 h-3 rounded-full bg-success" />
                <Text className="text-base font-bold text-success">{elapsedLabel}</Text>
              </View>

              {asignacion.hora_ingreso_real && (
                <View className="flex-row items-center gap-2">
                  <Text className="text-sm text-success/70">Entrada registrada a las</Text>
                  <Text className="text-sm font-semibold text-success">
                    {fmtTime(asignacion.hora_ingreso_real.slice(11, 19))}
                  </Text>
                </View>
              )}

              <View className="flex-row gap-4 mt-1">
                <View className="flex-1 bg-white/60 rounded-xl px-4 py-3">
                  <Text className="text-xs text-success/70">Inicio turno</Text>
                  <Text className="text-sm font-semibold text-success">
                    {fmtTime(asignacion.hora_inicio)}
                  </Text>
                </View>
                {asignacion.hora_fin_estimada && (
                  <View className="flex-1 bg-white/60 rounded-xl px-4 py-3">
                    <Text className="text-xs text-success/70">Fin estimado</Text>
                    <Text className="text-sm font-semibold text-success">
                      {fmtTime(asignacion.hora_fin_estimada)}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          )}

          {/* ── Firma ───────────────────────────────────────────── */}
          <View className="bg-card rounded-2xl border border-border px-5 py-5 gap-3"
            style={{ elevation: 1, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6 }}
          >
            <Text className="text-sm font-semibold text-foreground">{t('egreso.firma')}</Text>
            <Text className="text-sm text-muted-foreground">{t('egreso.firmaHint')}</Text>

            <View className="flex-row items-center gap-2 bg-info/10 rounded-xl px-4 py-3">
              <Ionicons name="document-text-outline" size={16} color="#3B82F6" />
              <Text className="text-xs text-info flex-1">
                Tu firma confirma la salida y queda registrada en el contrato diario de este turno.
              </Text>
            </View>
          </View>

          {/* ── CTA ─────────────────────────────────────────────── */}
          <Button
            label={t('egreso.marcar')}
            variant="primary"
            size="lg"
            fullWidth
            onPress={() => setSignatureVisible(true)}
          />

          <Text className="text-xs text-center text-muted-foreground">
            Se requiere firma digital para confirmar la salida.
          </Text>
        </ScrollView>
      </SafeAreaView>

      {/* ── Signature Modal ───────────────────────────────────── */}
      <SignaturePad
        visible={signatureVisible}
        onClose={() => setSignatureVisible(false)}
        onConfirm={handleEgreso}
        loading={egresoMutation.isPending}
      />
    </>
  );
}
