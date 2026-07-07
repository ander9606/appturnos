/**
 * Liquidación de turnos — app/liquidacion-turnos.tsx
 *
 * Gestores ven cuánto se le debe pagar a cada trabajador por sus turnos
 * completados en el período seleccionado.  Cada card es expandible para
 * ver el desglose turno por turno (pago base + extra + total).
 */
import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useLiquidacionTurnos } from '@/features/turnos/useTurnos';
import { Button } from '@/components/ui/Button';
import { useTheme } from '@/lib/theme';
import type { LiquidacionTurnosTrabajador, LiquidacionTurnoLinea } from '@api-client';

// ── Helpers ───────────────────────────────────────────────────────────────

const SHORT_DAYS   = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
const SHORT_MONTHS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

function fmtDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return `${SHORT_DAYS[d.getDay()]} ${d.getDate()} ${SHORT_MONTHS[d.getMonth()]}`;
}
function fmtHora(ts: string | null): string {
  if (!ts) return '—';
  // ts puede ser "2026-06-03 06:10:00" o "2026-06-03T06:10:00"
  const parts = ts.replace('T', ' ').split(' ');
  return parts[1]?.slice(0, 5) ?? '—';
}
function cop(n: number): string {
  return '$' + Math.round(n).toLocaleString('es-CO');
}
function buildDefaultRange(): { inicio: string; fin: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  const inicio = `${y}-${String(m).padStart(2, '0')}-01`;
  const lastDay = new Date(y, m, 0).getDate();
  const fin = `${y}-${String(m).padStart(2, '0')}-${lastDay}`;
  return { inicio, fin };
}
function buildMonthLabel(inicio: string): string {
  const d = new Date(`${inicio}T00:00:00`);
  const nombres = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                   'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  return `${nombres[d.getMonth()]} ${d.getFullYear()}`;
}

// ── TurnoLineaRow ─────────────────────────────────────────────────────────

function TurnoLineaRow({ t, primary }: { t: LiquidacionTurnoLinea; primary: string }) {
  const router = useRouter();
  const hasExtra = t.pago_extra > 0;
  return (
    <TouchableOpacity
      onPress={() => router.push(`/turno/${t.asignacion_id}`)}
      activeOpacity={0.7}
      className="py-3 border-b border-border last:border-b-0"
    >
      {/* Fila 1: fecha + monto */}
      <View className="flex-row items-start justify-between gap-2">
        <View className="flex-1">
          <Text className="text-sm font-semibold text-foreground" numberOfLines={1}>
            {t.oferta_titulo}
          </Text>
          <Text className="text-xs text-muted-foreground mt-0.5">
            {fmtDate(t.oferta_fecha)}
            {t.lugar ? `  ·  ${t.lugar}` : ''}
          </Text>
        </View>
        <Text className="text-sm font-bold text-foreground">{cop(t.pago_total)}</Text>
      </View>

      {/* Fila 2: horas + desglose pago */}
      <View className="flex-row items-center gap-3 mt-1.5 flex-wrap">
        <View className="flex-row items-center gap-1">
          <Ionicons name="time-outline" size={12} color="#64748B" />
          <Text className="text-xs text-muted-foreground">
            {fmtHora(t.hora_ingreso_real)} – {fmtHora(t.hora_egreso_real)}
            {'  '}({t.horas_trabajadas.toFixed(1)}h)
          </Text>
        </View>
        <View className="flex-row items-center gap-1">
          <Ionicons name="cash-outline" size={12} color="#64748B" />
          <Text className="text-xs text-muted-foreground">
            Base: {cop(t.pago_total - t.pago_extra)}
          </Text>
        </View>
        {hasExtra && (
          <View className="bg-amber-100 px-2 py-0.5 rounded-full">
            <Text className="text-[10px] font-semibold text-amber-700">
              Extra +{cop(t.pago_extra)}
            </Text>
          </View>
        )}
        {t.calificacion != null ? (
          <View className="flex-row items-center gap-0.5">
            <Ionicons name="star" size={11} color="#F59E0B" />
            <Text className="text-xs text-muted-foreground">{t.calificacion}</Text>
          </View>
        ) : (
          <View className="flex-row items-center gap-0.5">
            <Ionicons name="star-outline" size={11} color="#94A3B8" />
            <Text className="text-xs text-muted-foreground">Calificar</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

// ── TrabajadorCard ────────────────────────────────────────────────────────

function TrabajadorCard({
  item,
  primary,
}: {
  item: LiquidacionTurnosTrabajador;
  primary: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasExtra = item.pago_extra > 0;

  return (
    <View
      className="bg-card rounded-2xl overflow-hidden"
      style={{ elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } }}
    >
      {/* ── Header ──────────────────────────────────────────────────── */}
      <TouchableOpacity
        onPress={() => setExpanded((v) => !v)}
        activeOpacity={0.75}
        className="flex-row"
      >
        {/* Barra lateral de color */}
        <View className="w-1.5" style={{ backgroundColor: primary }} />

        <View className="flex-1 px-4 py-4 gap-2">
          {/* Nombre + chevron */}
          <View className="flex-row items-start justify-between gap-2">
            <View className="flex-1">
              <Text className="text-base font-bold text-foreground">
                {item.nombre} {item.apellido}
              </Text>
              <View className="flex-row items-center gap-2 mt-0.5">
                {item.cargo && (
                  <Text className="text-xs text-muted-foreground">{item.cargo}</Text>
                )}
                {item.ranking != null && (
                  <View className="flex-row items-center gap-0.5">
                    <Ionicons name="star" size={11} color="#F59E0B" />
                    <Text className="text-xs text-muted-foreground">
                      {item.ranking.toFixed(1)}
                    </Text>
                  </View>
                )}
              </View>
            </View>
            <Ionicons
              name={expanded ? 'chevron-up' : 'chevron-down'}
              size={18}
              color="#94A3B8"
            />
          </View>

          {/* Stats */}
          <View className="flex-row items-center gap-4">
            <View className="flex-row items-center gap-1">
              <Ionicons name="briefcase-outline" size={13} color="#64748B" />
              <Text className="text-xs text-muted-foreground">
                {item.total_turnos} turno{item.total_turnos !== 1 ? 's' : ''}
              </Text>
            </View>
            <View className="flex-row items-center gap-1">
              <Ionicons name="time-outline" size={13} color="#64748B" />
              <Text className="text-xs text-muted-foreground">
                {item.total_horas.toFixed(1)}h
              </Text>
            </View>
          </View>

          {/* Total a pagar */}
          <View className="flex-row items-center justify-between mt-1">
            <View className="gap-0.5">
              <Text className="text-xs text-muted-foreground">A pagar</Text>
              <Text className="text-xl font-bold" style={{ color: primary }}>
                {cop(item.pago_total)}
              </Text>
            </View>
            {hasExtra && (
              <View className="items-end gap-0.5">
                <Text className="text-[10px] text-muted-foreground">
                  Base: {cop(item.pago_base)}
                </Text>
                <View className="bg-amber-100 px-2.5 py-1 rounded-xl">
                  <Text className="text-xs font-semibold text-amber-700">
                    + {cop(item.pago_extra)} extra
                  </Text>
                </View>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>

      {/* ── Detalle de turnos (expandible) ──────────────────────────── */}
      {expanded && (
        <View className="px-4 pb-4 border-t border-border">
          <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mt-3 mb-1">
            Desglose por turno
          </Text>
          {item.turnos.map((t) => (
            <TurnoLineaRow key={t.asignacion_id} t={t} primary={primary} />
          ))}
          {/* Totales */}
          <View className="flex-row justify-end items-center gap-6 pt-3 border-t border-border mt-1">
            <Text className="text-xs text-muted-foreground">
              {item.total_turnos} turnos · {item.total_horas.toFixed(1)}h
            </Text>
            <Text className="text-base font-bold text-foreground">
              {cop(item.pago_total)}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────

export default function LiquidacionTurnosScreen() {
  const theme  = useTheme();
  const router = useRouter();
  const { inicio, fin } = useMemo(() => buildDefaultRange(), []);
  const monthLabel = useMemo(() => buildMonthLabel(inicio), [inicio]);

  const {
    data,
    isLoading,
    isError,
    refetch,
    isRefetching,
  } = useLiquidacionTurnos({ fecha_inicio: inicio, fecha_fin: fin });

  const trabajadores = data ?? [];

  const totalGeneral = useMemo(
    () => trabajadores.reduce((s, w) => s + w.pago_total, 0),
    [trabajadores]
  );

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitle: 'Liquidación',
          headerTitleStyle: { fontWeight: '700', fontSize: 17 },
          headerBackTitle: 'Turnos',
          headerTintColor: theme.primary,
          headerStyle: { backgroundColor: '#FFFFFF' },
          headerShadowVisible: true,
        }}
      />

      <SafeAreaView className="flex-1 bg-background" edges={['bottom']}>
        {isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color={theme.primary} />
          </View>
        ) : isError ? (
          <View className="flex-1 items-center justify-center gap-3 px-6">
            <Ionicons name="warning-outline" size={48} color="#94A3B8" />
            <Text className="text-base font-semibold text-foreground text-center">
              Error al cargar la liquidación
            </Text>
            <Button label="Reintentar" variant="secondary" onPress={() => refetch()} />
          </View>
        ) : (
          <FlatList
            data={trabajadores}
            keyExtractor={(item) => String(item.trabajador_id)}
            contentContainerStyle={{ padding: 20, gap: 12, paddingBottom: 32 }}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={isRefetching}
                onRefresh={refetch}
                tintColor={theme.primary}
                colors={[theme.primary]}
              />
            }
            ListHeaderComponent={
              <View className="mb-2 gap-3">
                {/* Período */}
                <View className="flex-row items-center justify-between">
                  <View>
                    <Text className="text-xs text-muted-foreground uppercase tracking-wide">
                      Período
                    </Text>
                    <Text className="text-base font-semibold text-foreground">
                      {monthLabel}
                    </Text>
                  </View>
                  <View className="bg-muted px-3 py-1.5 rounded-xl">
                    <Text className="text-xs text-muted-foreground">
                      {inicio.slice(8)} – {fin.slice(8)} {SHORT_MONTHS[new Date(`${inicio}T00:00:00`).getMonth()]}
                    </Text>
                  </View>
                </View>

                {/* Resumen global */}
                {trabajadores.length > 0 && (
                  <View
                    className="rounded-2xl px-5 py-4 flex-row items-center justify-between"
                    style={{ backgroundColor: theme.primary + '15' }}
                  >
                    <View className="gap-0.5">
                      <Text className="text-xs font-medium" style={{ color: theme.primary + 'AA' }}>
                        Total a pagar
                      </Text>
                      <Text className="text-2xl font-bold" style={{ color: theme.primary }}>
                        {cop(totalGeneral)}
                      </Text>
                    </View>
                    <View className="items-end gap-0.5">
                      <Text className="text-xs text-muted-foreground">
                        {trabajadores.length} trabajador{trabajadores.length !== 1 ? 'es' : ''}
                      </Text>
                      <Text className="text-xs text-muted-foreground">
                        {trabajadores.reduce((s, w) => s + w.total_turnos, 0)} turnos completados
                      </Text>
                    </View>
                  </View>
                )}
              </View>
            }
            renderItem={({ item }) => (
              <TrabajadorCard item={item} primary={theme.primary} />
            )}
            ItemSeparatorComponent={() => <View className="h-0" />}
            ListEmptyComponent={
              <View className="py-20 items-center gap-3 px-8">
                <Ionicons name="receipt-outline" size={48} color="#CBD5E1" />
                <Text className="text-base font-semibold text-foreground text-center">
                  Sin turnos completados
                </Text>
                <Text className="text-sm text-muted-foreground text-center">
                  No hay asignaciones completadas en {monthLabel.toLowerCase()}.
                </Text>
              </View>
            }
          />
        )}
      </SafeAreaView>
    </>
  );
}
