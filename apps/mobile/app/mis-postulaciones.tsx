/**
 * Mis postulaciones — trabajador_turnos
 *
 * Muestra todas las asignaciones del trabajador agrupadas por estado:
 *  - Pendientes  → esperando que el gestor confirme o rechace
 *  - Confirmadas → próximos turnos aprobados
 *  - Completadas → turnos finalizados con pago calculado
 *  - Canceladas  → rechazadas, canceladas o no presentadas
 */
import React, { useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useMisTurnos } from '@/features/turnos/useTurnos';
import type { Asignacion, EstadoAsignacion } from '@api-client';

// ── Helpers ───────────────────────────────────────────────────────────────

function fmtFecha(iso: string) {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' });
}

function fmtPago(n: number | null | undefined) {
  if (n == null) return null;
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);
}

// ── Config por estado ──────────────────────────────────────────────────────

const ESTADO_CFG: Record<string, {
  label: string; color: string; bg: string; icon: React.ComponentProps<typeof Ionicons>['name'];
}> = {
  pendiente:      { label: 'Pendiente',    color: '#D97706', bg: '#FEF3C7', icon: 'time-outline' },
  confirmado:     { label: 'Confirmado',   color: '#3B82F6', bg: '#DBEAFE', icon: 'checkmark-circle-outline' },
  en_progreso:    { label: 'En progreso',  color: '#059669', bg: '#D1FAE5', icon: 'play-circle-outline' },
  completado:     { label: 'Completado',   color: '#059669', bg: '#D1FAE5', icon: 'checkmark-done-outline' },
  cancelado:      { label: 'Cancelado',    color: '#EF4444', bg: '#FEE2E2', icon: 'close-circle-outline' },
  rechazado:      { label: 'Rechazado',    color: '#EF4444', bg: '#FEE2E2', icon: 'ban-outline' },
  no_presentado:  { label: 'No presentado',color: '#94A3B8', bg: '#F1F5F9', icon: 'alert-circle-outline' },
};

// ── Sub-components ─────────────────────────────────────────────────────────

function SectionHeader({ title, count }: { title: string; count: number }) {
  return (
    <View className="flex-row items-center gap-2 px-5 mb-3 mt-1">
      <Text className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
        {title}
      </Text>
      <View className="bg-muted rounded-full min-w-[18px] h-[18px] items-center justify-center px-1">
        <Text className="text-xs font-bold text-muted-foreground">{count}</Text>
      </View>
    </View>
  );
}

function PostulacionCard({
  asignacion,
  onPress,
}: {
  asignacion: Asignacion;
  onPress: () => void;
}) {
  const cfg = ESTADO_CFG[asignacion.estado] ?? ESTADO_CFG.pendiente;

  return (
    <Pressable
      onPress={onPress}
      className="mx-5 mb-3 bg-card rounded-2xl border border-border overflow-hidden active:opacity-80"
    >
      <View className="flex-row items-center gap-3 px-4 pt-4 pb-3">
        <View
          className="w-10 h-10 rounded-xl items-center justify-center"
          style={{ backgroundColor: cfg.bg }}
        >
          <Ionicons name={cfg.icon} size={20} color={cfg.color} />
        </View>
        <View className="flex-1">
          <Text className="text-sm font-bold text-foreground" numberOfLines={1}>
            {asignacion.oferta_titulo}
          </Text>
          <Text className="text-xs text-muted-foreground mt-0.5">
            {fmtFecha(asignacion.oferta_fecha)}
            {'  ·  '}
            {asignacion.hora_inicio}
            {asignacion.hora_fin_estimada ? ` – ${asignacion.hora_fin_estimada}` : ''}
          </Text>
          {asignacion.lugar && (
            <Text className="text-xs text-muted-foreground mt-0.5" numberOfLines={1}>
              {asignacion.lugar}
            </Text>
          )}
        </View>
        <View className="items-end gap-1.5">
          <View className="rounded-full px-2 py-0.5" style={{ backgroundColor: cfg.bg }}>
            <Text className="text-[10px] font-semibold" style={{ color: cfg.color }}>
              {cfg.label}
            </Text>
          </View>
          {asignacion.estado === 'completado' && asignacion.pago_total != null && (
            <Text className="text-xs font-bold text-success">
              {fmtPago(asignacion.pago_total)}
            </Text>
          )}
        </View>
      </View>
    </Pressable>
  );
}

// ── Screen ─────────────────────────────────────────────────────────────────

const GROUPS: { key: EstadoAsignacion[]; label: string }[] = [
  { key: ['pendiente'],                            label: 'Esperando confirmación' },
  { key: ['confirmado', 'en_progreso'],            label: 'Confirmadas' },
  { key: ['completado'],                           label: 'Completadas' },
  { key: ['cancelado', 'no_presentado'],               label: 'Canceladas / No presentadas' },
];

export default function MisPostulacionesScreen() {
  const router = useRouter();
  const { data: turnos = [], isLoading, refetch } = useMisTurnos();

  const grupos = useMemo(() =>
    GROUPS.map((g) => ({
      ...g,
      items: turnos.filter((a) => (g.key as string[]).includes(a.estado)),
    })).filter((g) => g.items.length > 0),
  [turnos]);

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['bottom']}>
      <Stack.Screen options={{ title: 'Mis postulaciones', headerShown: true }} />

      <ScrollView
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} />}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingVertical: 16, paddingBottom: 40 }}
      >
        {isLoading && (
          <View className="py-16 items-center">
            <ActivityIndicator color="#FF5A3C" />
          </View>
        )}

        {!isLoading && grupos.length === 0 && (
          <View className="items-center justify-center px-8 py-16 gap-3">
            <View className="w-16 h-16 rounded-2xl bg-muted items-center justify-center">
              <Ionicons name="calendar-outline" size={32} color="#94A3B8" />
            </View>
            <Text className="text-lg font-bold text-foreground text-center">
              Sin postulaciones
            </Text>
            <Text className="text-sm text-muted-foreground text-center">
              Aplica a turnos disponibles desde la pestaña Turnos.
            </Text>
          </View>
        )}

        {grupos.map((grupo) => (
          <View key={grupo.label} className="mb-4">
            <SectionHeader title={grupo.label} count={grupo.items.length} />
            {grupo.items.map((a) => (
              <PostulacionCard
                key={a.id}
                asignacion={a}
                onPress={() => router.push(`/turno/${a.id}`)}
              />
            ))}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
