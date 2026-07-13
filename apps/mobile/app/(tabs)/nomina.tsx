/**
 * Nómina — Tab "Nómina"
 *
 * Enruta a la vista correcta según el rol del usuario.
 * Cada vista vive en su propio módulo de features:
 *
 *   trabajador_nomina → features/nomina/trabajador/NominaTrabajadorView
 *   trabajador_turnos → features/nomina/NominaTurnosView
 *   jefe_turnos       → features/nomina/NominaGestorTurnosView
 *   gestores          → NominaGestorView (liquidación completa, inline aquí)
 */

import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { useAuthStore }           from '@/features/auth/useAuthStore';
import { NominaTrabajadorView }   from '@/features/nomina/trabajador';
import { NominaTurnosView }       from '@/features/nomina/NominaTurnosView';
import { NominaGestorTurnosView } from '@/features/nomina/NominaGestorTurnosView';
import { PeriodoBadge }           from '@/features/nomina/PeriodoBadge';
import { LiquidacionRow }         from '@/features/nomina/LiquidacionRow';
import { Button }                 from '@/components/ui/Button';
import { fmtPeriodo }             from '@/features/nomina/trabajador/nominaTrabajadorUtils';
import {
  usePeriodos, useLiquidacion,
  useLiquidarPeriodo,
} from '@/features/nomina/useNomina';
import { useCompensatoriosTodos } from '@/features/nomina/compensatorios/useCompensatorios';
import { ApiError } from '@api-client';
import { useTheme } from '@/lib/theme';
import { useRouter } from 'expo-router';

// ── Router de roles ───────────────────────────────────────────────────────

const GESTORES = ['admin_empresa', 'jefe_nomina', 'nomina'] as const;
type RolGestor = typeof GESTORES[number];

export default function NominaScreen() {
  const rol = useAuthStore((s) => s.usuario?.rol) ?? 'trabajador_nomina';

  if (GESTORES.includes(rol as RolGestor)) return <NominaGestorView />;
  if (rol === 'trabajador_turnos')         return <NominaTurnosView />;
  if (rol === 'jefe_turnos')               return <NominaGestorTurnosView />;
  return <NominaTrabajadorView />;
}

// ══════════════════════════════════════════════════════════════════════════
// Vista del GESTOR — liquidación completa del período
// ══════════════════════════════════════════════════════════════════════════

// ──────────────────────────────────────────────────────────────────────────

function NominaGestorView() {
  const theme = useTheme();
  const router = useRouter();
  const rol = useAuthStore((s) => s.usuario?.rol);

  const { data: periodosResp, isLoading: loadingPeriodos, refetch: refetchPeriodos } =
    usePeriodos();
  const periodos = periodosResp?.data ?? [];
  const [periodoId, setPeriodoId] = useState<number | undefined>(undefined);

  const activePeriodoId = periodoId ?? periodos[0]?.id;
  const activePeriodo   = periodos.find((p) => p.id === activePeriodoId) ?? periodos[0];

  const {
    data: liquidacion,
    isLoading: loadingLiq,
    refetch: refetchLiq,
    isRefetching,
  } = useLiquidacion(activePeriodoId ?? null);

  const liquidarMutation = useLiquidarPeriodo();

  // ponytail: carga todos los compensatorios de la empresa, filtra client-side por periodo+trabajador
  const { data: allComp } = useCompensatoriosTodos();

  const onRefresh = useCallback(() => {
    refetchPeriodos();
    refetchLiq();
  }, [refetchPeriodos, refetchLiq]);

  const handleLiquidar = () => {
    if (!activePeriodoId) return;
    Alert.alert(
      'Liquidar período',
      '¿Confirmas la liquidación? Esta acción es irreversible.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Liquidar',
          onPress: async () => {
            try {
              await liquidarMutation.mutateAsync(activePeriodoId);
              Alert.alert('Período liquidado');
            } catch (err) {
              const msg = err instanceof ApiError ? err.message : 'Error al liquidar';
              Alert.alert('Error', msg);
            }
          },
        },
      ],
    );
  };

  if (loadingPeriodos) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center" edges={['top']}>
        <ActivityIndicator size="large" color={theme.primary} />
      </SafeAreaView>
    );
  }

  const lineas  = liquidacion?.lineas ?? [];
  const totales = liquidacion?.totales;

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <FlatList
        data={lineas}
        keyExtractor={(item) => String(item.trabajador_id)}
        renderItem={({ item }) => (
          <LiquidacionRow
            linea={item}
            periodoId={activePeriodoId}
            compensatorios={(allComp ?? []).filter(
              (c) => c.trabajador_id === item.trabajador_id && c.periodo_id === activePeriodoId
            )}
          />
        )}
        contentContainerClassName="gap-2 pb-10"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={onRefresh}
            tintColor={theme.primary} colors={[theme.primary]} />
        }
        ListHeaderComponent={
          <View className="gap-4 pb-2">
            <View className="bg-success pt-4 pb-6 px-6 rounded-b-[28px] gap-2">
              <View className="flex-row items-center justify-between">
                <View>
                  <Text className="text-white/80 text-xs font-medium uppercase tracking-wide">
                    Nómina
                  </Text>
                  <Text className="text-white text-xl font-bold">
                    {activePeriodo ? fmtPeriodo(activePeriodo) : '—'}
                  </Text>
                </View>
                <View className="flex-row items-center gap-2">
                  {activePeriodo && <PeriodoBadge estado={activePeriodo.estado} />}
                </View>
              </View>

              {totales && (
                <View className="bg-white/15 rounded-2xl px-4 py-3 mt-1">
                  <Text className="text-white/80 text-xs">Total bruto</Text>
                  <Text className="text-white text-3xl font-extrabold">
                    ${totales.total_general.toLocaleString('es-CO')}
                  </Text>
                  <Text className="text-white/70 text-xs mt-0.5">
                    {totales.trabajadores} empleados
                  </Text>
                </View>
              )}
            </View>

            <View className="px-5 gap-3">
              {periodos.length > 0 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View className="flex-row gap-2 py-1">
                    {periodos.slice(0, 8).map((p) => (
                      <TouchableOpacity
                        key={p.id}
                        onPress={() => setPeriodoId(p.id)}
                        className={[
                          'px-4 py-2 rounded-full border flex-row items-center gap-1.5',
                          p.id === activePeriodoId
                            ? 'bg-foreground border-foreground'
                            : 'bg-card border-border',
                        ].join(' ')}
                      >
                        <Text className={`text-xs font-medium ${
                          p.id === activePeriodoId ? 'text-white' : 'text-foreground'
                        }`}>
                          {fmtPeriodo(p)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              )}

              {activePeriodo && (
                <View className="gap-2">
                  {/* Context label explaining what the current state means */}
                  <View className="flex-row items-center gap-1.5 px-1">
                    <Ionicons
                      name={
                        activePeriodo.estado === 'abierto'   ? 'lock-open-outline'
                        : activePeriodo.estado === 'cerrado' ? 'lock-closed-outline'
                        : 'checkmark-circle-outline'
                      }
                      size={14}
                      color="#64748B"
                    />
                    <Text className="text-xs text-muted-foreground">
                      {activePeriodo.estado === 'abierto'
                        ? 'Los trabajadores pueden registrar horas'
                        : activePeriodo.estado === 'cerrado'
                        ? 'Horas congeladas — pendiente de pago'
                        : 'Período pagado'}
                    </Text>
                  </View>
                  <View className="flex-row gap-2">
                    {activePeriodo.estado === 'cerrado' && rol !== 'nomina' && (
                      <View className="flex-1 gap-1">
                        <Button
                          label={liquidarMutation.isPending ? 'Liquidando…' : 'Liquidar período'}
                          variant="success"
                          size="lg"
                          fullWidth
                          loading={liquidarMutation.isPending}
                          onPress={handleLiquidar}
                        />
                        {!liquidarMutation.isPending && (
                          <Text className="text-xs text-muted-foreground text-center">No se puede deshacer</Text>
                        )}
                      </View>
                    )}
                    {activePeriodo.estado === 'liquidado' && (
                      <View className="flex-1 bg-muted rounded-2xl py-3 items-center">
                        <Text className="text-sm text-muted-foreground">Período liquidado</Text>
                      </View>
                    )}
                  </View>
                </View>
              )}

              {activePeriodo && (
                <Text className="text-xs font-bold text-muted-foreground uppercase tracking-widest px-1">Hoy</Text>
              )}

              {activePeriodo && (
                <TouchableOpacity
                  onPress={() => router.push(`/registros-periodo?periodoId=${activePeriodoId}`)}
                  className="flex-row items-center justify-between bg-card border border-border rounded-2xl px-4 py-3"
                >
                  <View className="flex-row items-center gap-2">
                    <Ionicons name="calendar-outline" size={16} color="#64748B" />
                    <Text className="text-sm font-medium text-foreground">Registros del equipo</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color="#94A3B8" />
                </TouchableOpacity>
              )}

              {/* Estas 4 pantallas no admiten el rol 'nomina' (solo lectura) — no mostrar accesos que llevan a "Sin acceso" */}
              {rol !== 'nomina' && (
                <>
                  <TouchableOpacity
                    onPress={() => router.push('/dashboard-asistencia')}
                    className="flex-row items-center justify-between bg-card border border-border rounded-2xl px-4 py-3"
                  >
                    <View className="flex-row items-center gap-2">
                      <Ionicons name="people-outline" size={16} color="#64748B" />
                      <Text className="text-sm font-medium text-foreground">Asistencia hoy</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color="#94A3B8" />
                  </TouchableOpacity>

                  <Text className="text-xs font-bold text-muted-foreground uppercase tracking-widest px-1">Aprobaciones</Text>

                  <TouchableOpacity
                    onPress={() => router.push('/reingresos-pendientes')}
                    className="flex-row items-center justify-between bg-card border border-border rounded-2xl px-4 py-3"
                  >
                    <View className="flex-row items-center gap-2">
                      <Ionicons name="enter-outline" size={16} color="#64748B" />
                      <Text className="text-sm font-medium text-foreground">Reingresos pendientes</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color="#94A3B8" />
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => router.push('/gestor-compensatorios')}
                    className="flex-row items-center justify-between bg-card border border-border rounded-2xl px-4 py-3"
                  >
                    <View className="flex-row items-center gap-2">
                      <Ionicons name="calendar-outline" size={16} color="#64748B" />
                      <Text className="text-sm font-medium text-foreground">Descansos compensatorios</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color="#94A3B8" />
                  </TouchableOpacity>

                  <Text className="text-xs font-bold text-muted-foreground uppercase tracking-widest px-1">Configuración</Text>

                  <TouchableOpacity
                    onPress={() => router.push('/asignaciones-lugar')}
                    className="flex-row items-center justify-between bg-card border border-border rounded-2xl px-4 py-3"
                  >
                    <View className="flex-row items-center gap-2">
                      <Ionicons name="location-outline" size={16} color="#64748B" />
                      <Text className="text-sm font-medium text-foreground">Asignaciones de lugar</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color="#94A3B8" />
                  </TouchableOpacity>
                </>
              )}

              <Text className="text-sm font-semibold text-foreground">
                Detalle por empleado
              </Text>
            </View>
          </View>
        }
        ListEmptyComponent={
          loadingLiq ? (
            <View className="py-12 items-center">
              <ActivityIndicator color={theme.primary} />
            </View>
          ) : (
            <View className="py-12 items-center gap-3 px-8">
              <Ionicons name="bar-chart-outline" size={40} color="#94A3B8" />
              <Text className="text-base font-semibold text-foreground text-center">
                Sin registros en este período
              </Text>
            </View>
          )
        }
        ItemSeparatorComponent={() => <View className="h-2" />}
        contentContainerStyle={{ paddingHorizontal: 20 }}
      />
    </SafeAreaView>
  );
}
