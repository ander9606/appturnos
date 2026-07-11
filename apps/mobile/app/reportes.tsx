/**
 * Reportes — resumen de asistencia y costos para admin_empresa, jefe_turnos, jefe_nomina.
 * Permite seleccionar un rango de fechas y consultar:
 *   - Asistencia: turnos por trabajador y días de nómina
 *   - Costos: costo de mano de obra (turnos + nómina)
 */
import React, { useState, useMemo } from 'react';
import {
  View, Text, ScrollView, Pressable, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';

import { reportesApi } from '@api-client';
import type { AsistenciaTurno, AsistenciaNomina, CostoNominaDetalle } from '@api-client';
import { useTheme } from '@/lib/theme';
import { formatDate, formatCOP, toISODate } from '@/lib/formatters';
import { useRoleGuard } from '@/components/RoleGuard';

// ── Rango presets ─────────────────────────────────────────────────────────

interface Preset { label: string; desde: string; hasta: string }

function buildPresets(): Preset[] {
  const now   = new Date();
  const y     = now.getFullYear();
  const m     = now.getMonth();

  const primeroMesActual = new Date(y, m, 1);
  const ultimoMesActual  = new Date(y, m + 1, 0);
  const primeroMesAnt    = new Date(y, m - 1, 1);
  const ultimoMesAnt     = new Date(y, m, 0);
  const hace90           = new Date(now);
  hace90.setDate(now.getDate() - 90);

  return [
    { label: 'Este mes',      desde: toISODate(primeroMesActual), hasta: toISODate(now) },
    { label: 'Mes anterior',  desde: toISODate(primeroMesAnt),    hasta: toISODate(ultimoMesAnt) },
    { label: 'Últimos 3m',   desde: toISODate(hace90),            hasta: toISODate(now) },
  ];
}

// ── Hooks ─────────────────────────────────────────────────────────────────

function useAsistencia(desde: string, hasta: string) {
  return useQuery({
    queryKey: ['reportes', 'asistencia', desde, hasta],
    queryFn:  () => reportesApi.asistencia({ desde, hasta }),
    staleTime: 120_000,
  });
}

function useCostos(desde: string, hasta: string) {
  return useQuery({
    queryKey: ['reportes', 'costos', desde, hasta],
    queryFn:  () => reportesApi.costos({ desde, hasta }),
    staleTime: 120_000,
  });
}

// ── Subcomponents ─────────────────────────────────────────────────────────

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <View className="flex-1 bg-card border border-border rounded-2xl p-4 gap-1">
      <Text className="text-xs text-muted-foreground" numberOfLines={1}>{label}</Text>
      <Text className="text-xl font-bold text-foreground">{value}</Text>
      {sub ? <Text className="text-xs text-muted-foreground">{sub}</Text> : null}
    </View>
  );
}

function SectionTitle({ title }: { title: string }) {
  return (
    <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-widest px-1 mb-3 mt-5">
      {title}
    </Text>
  );
}

function TurnoRow({ t }: { t: AsistenciaTurno }) {
  return (
    <View className="flex-row items-center px-4 py-3 border-b border-border last:border-b-0">
      <View className="flex-1">
        <Text className="text-sm font-medium text-foreground">
          {t.nombre}{t.apellido ? ` ${t.apellido}` : ''}
        </Text>
        <Text className="text-xs text-muted-foreground mt-0.5">
          {t.completados} completados · {t.no_presentados} ausencias
        </Text>
      </View>
      <View className="items-end">
        <Text className="text-sm font-semibold text-foreground">{t.total_turnos}</Text>
        <Text className="text-xs text-muted-foreground">turnos</Text>
      </View>
    </View>
  );
}

function NominaRow({ n }: { n: AsistenciaNomina }) {
  return (
    <View className="flex-row items-center px-4 py-3 border-b border-border last:border-b-0">
      <Text className="flex-1 text-sm font-medium text-foreground">
        {n.nombre}{n.apellido ? ` ${n.apellido}` : ''}
      </Text>
      <View className="items-end">
        <Text className="text-sm font-semibold text-foreground">{n.dias_registrados}</Text>
        <Text className="text-xs text-muted-foreground">días</Text>
      </View>
    </View>
  );
}

function CostoRow({ d }: { d: CostoNominaDetalle }) {
  return (
    <View className="flex-row items-center px-4 py-3 border-b border-border last:border-b-0">
      <Text className="flex-1 text-sm font-medium text-foreground">
        {d.nombre}{d.apellido ? ` ${d.apellido}` : ''}
      </Text>
      <Text className="text-sm font-semibold text-foreground">{formatCOP(d.total)}</Text>
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────

export default function ReportesScreen() {
  const theme   = useTheme();
  const presets = useMemo(buildPresets, []);
  const [presetIdx, setPresetIdx] = useState(0);

  const { desde, hasta } = presets[presetIdx];

  const asistencia = useAsistencia(desde, hasta);
  const costos     = useCostos(desde, hasta);

  const isLoading = asistencia.isLoading || costos.isLoading;

  // Totales de asistencia
  const totalTurnos = useMemo(
    () => (asistencia.data?.turnos ?? []).reduce((s, t) => s + t.total_turnos, 0),
    [asistencia.data]
  );
  const totalAusencias = useMemo(
    () => (asistencia.data?.turnos ?? []).reduce((s, t) => s + t.no_presentados, 0),
    [asistencia.data]
  );

  const denied = useRoleGuard(['admin_empresa', 'jefe_turnos', 'jefe_nomina']);
  if (denied) return denied;

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['bottom']}>
      <Stack.Screen options={{ title: 'Reportes', headerShown: true }} />

      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 48 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Selector de rango ────────────────────────────────── */}
        <View className="flex-row gap-2 mb-2">
          {presets.map((p, i) => (
            <Pressable
              key={p.label}
              onPress={() => setPresetIdx(i)}
              className="flex-1 h-9 rounded-xl items-center justify-center active:opacity-70"
              style={{ backgroundColor: i === presetIdx ? theme.primary : '#F1F5F9' }}
            >
              <Text
                className="text-xs font-semibold"
                style={{ color: i === presetIdx ? '#fff' : '#64748B' }}
              >
                {p.label}
              </Text>
            </Pressable>
          ))}
        </View>
        <Text className="text-xs text-muted-foreground text-center mb-6">
          {formatDate(desde)} – {formatDate(hasta)}
        </Text>

        {isLoading ? (
          <View className="items-center justify-center py-20">
            <ActivityIndicator size="large" color={theme.primary} />
          </View>
        ) : (
          <>
            {/* ── Resumen costos ───────────────────────────────── */}
            <SectionTitle title="Costos de mano de obra" />
            <View className="flex-row gap-3 mb-3">
              <StatCard
                label="Total período"
                value={formatCOP(costos.data?.costo_total ?? 0)}
              />
            </View>
            <View className="flex-row gap-3">
              <StatCard
                label="Turnos"
                value={formatCOP(costos.data?.turnos.costo ?? 0)}
                sub={`${costos.data?.turnos.turnos_completados ?? 0} completados`}
              />
              <StatCard
                label="Nómina"
                value={formatCOP(costos.data?.nomina.costo ?? 0)}
                sub={`${costos.data?.nomina.trabajadores ?? 0} trabajadores`}
              />
            </View>

            {/* Detalle nómina */}
            {(costos.data?.nomina.detalle ?? []).length > 0 && (
              <>
                <SectionTitle title="Nómina por trabajador" />
                <View className="bg-card border border-border rounded-2xl overflow-hidden">
                  {costos.data!.nomina.detalle.map((d) => (
                    <CostoRow key={d.trabajador_id} d={d} />
                  ))}
                </View>
              </>
            )}

            {/* ── Asistencia turnos ────────────────────────────── */}
            <SectionTitle title="Asistencia — Turnos" />
            <View className="flex-row gap-3 mb-3">
              <StatCard label="Total turnos" value={String(totalTurnos)} />
              <StatCard label="Ausencias" value={String(totalAusencias)} />
            </View>

            {(asistencia.data?.turnos ?? []).length > 0 ? (
              <View className="bg-card border border-border rounded-2xl overflow-hidden">
                {asistencia.data!.turnos.map((t) => (
                  <TurnoRow key={t.trabajador_id} t={t} />
                ))}
              </View>
            ) : (
              <View className="bg-card border border-border rounded-2xl p-6 items-center">
                <Text className="text-sm text-muted-foreground">
                  Sin turnos en este período
                </Text>
              </View>
            )}

            {/* ── Asistencia nómina ────────────────────────────── */}
            {(asistencia.data?.nomina ?? []).length > 0 && (
              <>
                <SectionTitle title="Asistencia — Nómina" />
                <View className="bg-card border border-border rounded-2xl overflow-hidden">
                  {asistencia.data!.nomina.map((n) => (
                    <NominaRow key={n.trabajador_id} n={n} />
                  ))}
                </View>
              </>
            )}

            {/* Error states */}
            {(asistencia.isError || costos.isError) && (
              <View className="mt-4 bg-danger/10 border border-danger/30 rounded-2xl p-4 flex-row items-center gap-3">
                <Ionicons name="warning-outline" size={20} color="#EF4444" />
                <Text className="text-sm text-danger flex-1">
                  No se pudieron cargar algunos datos. Comprueba tu conexión.
                </Text>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
