/**
 * Nómina — Tab "Nómina"
 *
 * Vista bifurcada según rol:
 *   trabajador_nomina → mis registros del período + resumen de horas
 *   jefe_nomina / admin_empresa / nomina → liquidación completa + gestión
 */
import React, { useState, useMemo, useCallback } from 'react';
import {
  View, Text, FlatList, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuthStore }        from '@/features/auth/useAuthStore';
import { usePeriodos, useRegistros, useLiquidacion,
         useCerrarPeriodo, useLiquidarPeriodo }  from '@/features/nomina/useNomina';
import { PeriodoBadge }        from '@/features/nomina/PeriodoBadge';
import { RegistroCard }        from '@/features/nomina/RegistroCard';
import { LiquidacionRow }      from '@/features/nomina/LiquidacionRow';
import { NominaTurnosView }    from '@/features/nomina/NominaTurnosView';
import { calcularResumenHoras } from '@api-client';
import { ApiError }            from '@api-client';
import type { PeriodoNomina }  from '@api-client';
import { useTheme }            from '@/lib/theme';

// ── Helpers ───────────────────────────────────────────────────────────────

const SHORT_MONTHS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

function fmtPeriodo(p: PeriodoNomina): string {
  const [, ms, ds] = p.fecha_inicio.split('-');
  const [, me, de] = p.fecha_fin.split('-');
  const mi = Number(ms) - 1;
  const mf = Number(me) - 1;
  if (mi === mf)
    return `${Number(ds)}–${Number(de)} ${SHORT_MONTHS[mi]}`;
  return `${Number(ds)} ${SHORT_MONTHS[mi]} – ${Number(de)} ${SHORT_MONTHS[mf]}`;
}

const GESTORES = ['admin_empresa', 'jefe_nomina', 'nomina'] as const;
type RolGestor = typeof GESTORES[number];

// ── Screen ────────────────────────────────────────────────────────────────

export default function NominaScreen() {
  const usuario = useAuthStore((s) => s.usuario);
  const rol     = usuario?.rol ?? 'trabajador_nomina';

  if (GESTORES.includes(rol as RolGestor)) return <NominaGestorView />;
  if (rol === 'trabajador_turnos')         return <NominaTurnosView />;
  return <NominaTrabajadorView />;
}

// ══════════════════════════════════════════════════════════════════════════
// Vista del TRABAJADOR
// ══════════════════════════════════════════════════════════════════════════

function NominaTrabajadorView() {
  const theme = useTheme();

  // Fetch all periods, pick the first open one (most recent)
  const { data: periodosResp, isLoading: loadingPeriodos, refetch: refetchPeriodos } =
    usePeriodos('abierto');

  const periodos = periodosResp?.data ?? [];
  const [periodoId, setPeriodoId] = useState<number | undefined>(undefined);

  // Once loaded, default to first (most recent) period
  const activePeriodoId = periodoId ?? periodos[0]?.id;
  const activePeriodo   = periodos.find((p) => p.id === activePeriodoId) ?? periodos[0];

  const {
    data: registrosResp,
    isLoading: loadingRegistros,
    refetch: refetchRegistros,
    isRefetching,
  } = useRegistros({ periodo_id: activePeriodoId, limit: 100 });

  const registros = registrosResp?.data ?? [];

  const resumen = useMemo(() => calcularResumenHoras(registros), [registros]);

  // Horas de la semana actual (lunes → hoy)
  const resumenSemana = useMemo(() => {
    const hoy = new Date();
    const lunes = new Date(hoy);
    const diaSemana = hoy.getDay();
    lunes.setDate(hoy.getDate() - (diaSemana === 0 ? 6 : diaSemana - 1));
    lunes.setHours(0, 0, 0, 0);
    const semanaRegistros = registros.filter((r) => {
      const fecha = new Date(`${r.fecha}T00:00:00`);
      return fecha >= lunes;
    });
    return calcularResumenHoras(semanaRegistros);
  }, [registros]);

  const onRefresh = useCallback(() => {
    refetchPeriodos();
    refetchRegistros();
  }, []);

  if (loadingPeriodos) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center" edges={['top']}>
        <ActivityIndicator size="large" color={theme.primary} />
      </SafeAreaView>
    );
  }

  if (periodos.length === 0) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center gap-3 px-8" edges={['top']}>
        <Text className="text-4xl">📋</Text>
        <Text className="text-base font-semibold text-foreground text-center">
          Sin período activo
        </Text>
        <Text className="text-sm text-muted-foreground text-center">
          Tu responsable aún no ha abierto un período de nómina.
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <FlatList
        data={registros}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => <RegistroCard registro={item} />}
        contentContainerClassName="gap-2 pb-8"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={onRefresh}
            tintColor={theme.primary} colors={[theme.primary]} />
        }
        ListHeaderComponent={
          <View className="gap-4 pb-2">
            {/* ── Header ─────────────────────────────────────── */}
            <View className="pt-4 pb-6 px-6 rounded-b-[28px] gap-3"
              style={{ backgroundColor: theme.primary }}>
              <View className="gap-1">
                <Text className="text-white/80 text-xs font-medium uppercase tracking-wide">
                  Mi Nómina
                </Text>
                <Text className="text-white text-xl font-bold">
                  {activePeriodo ? fmtPeriodo(activePeriodo) : '—'}
                </Text>
                {activePeriodo && <PeriodoBadge estado={activePeriodo.estado} />}
              </View>

              {/* Card "Esta semana" */}
              <View className="bg-white/15 rounded-2xl px-4 py-3 flex-row gap-4">
                <View className="gap-0.5 flex-1">
                  <Text className="text-white text-base font-extrabold">
                    {resumenSemana.totalHoras.toFixed(1)}h
                  </Text>
                  <Text className="text-white/70 text-[10px]">Esta semana</Text>
                </View>
                {(resumenSemana.extraDiurnas + resumenSemana.extraNocturnas) > 0 && (
                  <View className="gap-0.5 flex-1">
                    <Text className="text-white text-base font-extrabold">
                      {(resumenSemana.extraDiurnas + resumenSemana.extraNocturnas).toFixed(1)}h
                    </Text>
                    <Text className="text-white/70 text-[10px]">Horas extra</Text>
                  </View>
                )}
                <View className="gap-0.5 flex-1">
                  <Text className="text-white text-base font-extrabold">
                    {resumenSemana.diasRegistrados}d
                  </Text>
                  <Text className="text-white/70 text-[10px]">Días sem.</Text>
                </View>
              </View>
            </View>

            {/* ── Resumen horas ───────────────────────────────── */}
            <View className="px-5 gap-3">
              <View className="flex-row gap-2">
                <StatCard label="Total horas"  value={`${resumen.totalHoras.toFixed(1)}h`}  color="text-foreground" />
                <StatCard label="Ordinarias"   value={`${resumen.ordinarias.toFixed(1)}h`}   color="text-foreground" />
                <StatCard label="Días regist." value={String(resumen.diasRegistrados)} color="text-info" />
              </View>

              {/* Extras row (only shown if present) */}
              {(resumen.extraDiurnas > 0 || resumen.extraNocturnas > 0 ||
                resumen.nocturnas > 0    || resumen.festivo > 0) && (
                <View className="bg-primary-50 rounded-2xl px-4 py-3 gap-2">
                  <Text className="text-xs font-semibold text-primary-600">Horas con recargo</Text>
                  <View className="flex-row flex-wrap gap-3">
                    {resumen.extraDiurnas > 0 && (
                      <HoraChip label="Extra diurna"  value={resumen.extraDiurnas}  color="text-primary-500" />
                    )}
                    {resumen.extraNocturnas > 0 && (
                      <HoraChip label="Extra noct."   value={resumen.extraNocturnas} color="text-primary-600" />
                    )}
                    {resumen.nocturnas > 0 && (
                      <HoraChip label="Nocturnas"     value={resumen.nocturnas}     color="text-info" />
                    )}
                    {resumen.festivo > 0 && (
                      <HoraChip label="Festivo"       value={resumen.festivo}       color="text-danger" />
                    )}
                  </View>
                </View>
              )}

              {/* Period selector (if multiple open) */}
              {periodos.length > 1 && (
                <View className="flex-row gap-2 flex-wrap">
                  {periodos.map((p) => (
                    <TouchableOpacity
                      key={p.id}
                      onPress={() => setPeriodoId(p.id)}
                      className={[
                        'px-3 py-1.5 rounded-full border',
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
              )}

              <Text className="text-sm font-semibold text-foreground">
                Registros del período
              </Text>
            </View>
          </View>
        }
        ListEmptyComponent={
          loadingRegistros ? (
            <View className="py-12 items-center">
              <ActivityIndicator color={theme.primary} />
            </View>
          ) : (
            <View className="py-12 items-center gap-3 px-8">
              <Text className="text-4xl">📋</Text>
              <Text className="text-base font-semibold text-foreground text-center">
                Sin registros aún
              </Text>
              <Text className="text-sm text-muted-foreground text-center">
                No hay registros en este período todavía.
              </Text>
            </View>
          )
        }
        ItemSeparatorComponent={() => <View className="h-2" />}
        style={{ paddingHorizontal: 0 }}
        contentContainerStyle={{ paddingHorizontal: 20 }}
      />
    </SafeAreaView>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// Vista del GESTOR (jefe_nomina / admin / nomina)
// ══════════════════════════════════════════════════════════════════════════

function NominaGestorView() {
  const theme = useTheme();

  // All periods (latest first)
  const { data: periodosResp, isLoading: loadingPeriodos, refetch: refetchPeriodos } =
    usePeriodos();

  const periodos        = periodosResp?.data ?? [];
  const [periodoId, setPeriodoId] = useState<number | undefined>(undefined);

  const activePeriodoId = periodoId ?? periodos[0]?.id;
  const activePeriodo   = periodos.find((p) => p.id === activePeriodoId) ?? periodos[0];

  const {
    data: liquidacion,
    isLoading: loadingLiq,
    refetch: refetchLiq,
    isRefetching,
  } = useLiquidacion(activePeriodoId ?? null);

  const cerrarMutation    = useCerrarPeriodo();
  const liquidarMutation  = useLiquidarPeriodo();

  const onRefresh = useCallback(() => {
    refetchPeriodos();
    refetchLiq();
  }, []);

  const handleCerrar = () => {
    if (!activePeriodoId) return;
    Alert.alert(
      'Cerrar período',
      '¿Confirmas que deseas cerrar este período? Ya no se podrán añadir registros.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Cerrar',
          style: 'destructive',
          onPress: async () => {
            try {
              await cerrarMutation.mutateAsync(activePeriodoId);
              Alert.alert('✅ Período cerrado');
            } catch (err) {
              const msg = err instanceof ApiError ? err.message : 'Error al cerrar el período';
              Alert.alert('Error', msg);
            }
          },
        },
      ],
    );
  };

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
              Alert.alert('✅ Período liquidado');
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
        renderItem={({ item }) => <LiquidacionRow linea={item} />}
        contentContainerClassName="gap-2 pb-10"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={onRefresh}
            tintColor={theme.primary} colors={[theme.primary]} />
        }
        ListHeaderComponent={
          <View className="gap-4 pb-2">
            {/* ── Header ─────────────────────────────────────── */}
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
                {activePeriodo && <PeriodoBadge estado={activePeriodo.estado} />}
              </View>

              {/* Big total */}
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
              {/* Period selector pills */}
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

              {/* Period actions */}
              {activePeriodo && (
                <View className="flex-row gap-2">
                  {activePeriodo.estado === 'abierto' && (
                    <TouchableOpacity
                      onPress={handleCerrar}
                      disabled={cerrarMutation.isPending}
                      className="flex-1 bg-warning-light border border-amber-200 rounded-2xl py-3 items-center"
                    >
                      <Text className="text-sm font-semibold text-amber-700">
                        {cerrarMutation.isPending ? 'Cerrando…' : 'Cerrar período'}
                      </Text>
                    </TouchableOpacity>
                  )}
                  {activePeriodo.estado === 'cerrado' && (
                    <TouchableOpacity
                      onPress={handleLiquidar}
                      disabled={liquidarMutation.isPending}
                      className="flex-1 bg-success-light border border-green-200 rounded-2xl py-3 items-center"
                    >
                      <Text className="text-sm font-semibold text-success">
                        {liquidarMutation.isPending ? 'Liquidando…' : '✅ Liquidar período'}
                      </Text>
                    </TouchableOpacity>
                  )}
                  {activePeriodo.estado === 'liquidado' && (
                    <View className="flex-1 bg-muted rounded-2xl py-3 items-center">
                      <Text className="text-sm text-muted-foreground">Período liquidado</Text>
                    </View>
                  )}
                </View>
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
              <Text className="text-4xl">📊</Text>
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

// ── Primitivos locales ────────────────────────────────────────────────────

type ColorToken =
  | 'text-foreground' | 'text-muted-foreground'
  | 'text-primary' | 'text-primary-500' | 'text-primary-600'
  | 'text-info' | 'text-success' | 'text-warning' | 'text-danger';

function StatCard({ label, value, color }: { label: string; value: string; color: ColorToken }) {
  return (
    <View className="flex-1 bg-card rounded-2xl px-3 py-3 gap-0.5"
      style={{ elevation: 1, shadowColor:'#000', shadowOpacity:0.04, shadowRadius:6 }}>
      <Text className={`text-xl font-extrabold ${color}`}>{value}</Text>
      <Text className="text-[10px] text-muted-foreground">{label}</Text>
    </View>
  );
}

function HoraChip({ label, value, color }: { label: string; value: number; color: ColorToken }) {
  return (
    <View className="gap-0.5">
      <Text className={`text-sm font-bold ${color}`}>{value.toFixed(1)}h</Text>
      <Text className="text-[10px] text-muted-foreground">{label}</Text>
    </View>
  );
}
