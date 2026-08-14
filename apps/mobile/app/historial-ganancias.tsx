/**
 * Historial de ganancias — vista consolidada por período.
 *
 *   trabajador_turnos → total cobrado por período de nómina (turnos completados)
 *   trabajador_nomina → extras por período de nómina (el salario base es fijo,
 *                        se muestra aparte; lo que varía período a período son
 *                        las horas con recargo)
 */
import React, { useMemo } from 'react';
import { View, Text, FlatList, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { useAuthStore } from '@/features/auth/useAuthStore';
import { useTheme } from '@/lib/theme';
import { formatCOP } from '@/lib/formatters';
import { apiErrorMessage } from '@/lib/apiErrorMessage';
import { Button } from '@/components/ui/Button';
import { PeriodoBadge } from '@/features/nomina/PeriodoBadge';
import { TipoPeriodoBadge } from '@/features/nomina/TipoPeriodoBadge';
import { useMisTurnos } from '@/features/turnos/useTurnos';
import { usePeriodos, useNominaPerfil, useRegistrosHistorial } from '@/features/nomina/useNomina';
import { calcularResumenPeriodo, getValorHora, fmtPeriodo, type ResumenPeriodoNomina } from '@/features/nomina/trabajador/nominaTrabajadorUtils';
import type { PeriodoNomina, RegistroDiario, Asignacion } from '@api-client';

export default function HistorialGananciasScreen() {
  const rol = useAuthStore((s) => s.usuario?.rol);
  return rol === 'trabajador_nomina' ? <HistorialNomina /> : <HistorialTurnos />;
}

// ══════════════════════════════════════════════════════════════════════════
// trabajador_turnos — historial por período de nómina
// ══════════════════════════════════════════════════════════════════════════

interface TotalesPeriodo { count: number; horas: number; pago: number }

function sumarPeriodo(turnos: Asignacion[], periodo: PeriodoNomina): TotalesPeriodo {
  return turnos.reduce((acc, a) => {
    if (a.estado !== 'completado') return acc;
    if (a.oferta_fecha < periodo.fecha_inicio || a.oferta_fecha > periodo.fecha_fin) return acc;
    return {
      count: acc.count + 1,
      horas: acc.horas + (Number(a.horas_trabajadas) || 0),
      pago:  acc.pago  + (Number(a.pago_total) || 0),
    };
  }, { count: 0, horas: 0, pago: 0 });
}

function HistorialTurnos() {
  const theme = useTheme();
  const { data: turnos, isLoading: loadingTurnos, isError, error, refetch, isRefetching } = useMisTurnos();
  const { data: periodosResp, isLoading: loadingPeriodos } = usePeriodos();
  const periodos = periodosResp?.data ?? [];
  const isLoading = loadingTurnos || loadingPeriodos;

  const filas = useMemo(() => {
    const completados = (turnos ?? []).filter((a) => a.estado === 'completado');
    if (completados.length === 0) return [];
    const fechaMin = completados.reduce(
      (min, a) => (a.oferta_fecha < min ? a.oferta_fecha : min),
      completados[0].oferta_fecha,
    );

    const out: { periodo: PeriodoNomina; totales: TotalesPeriodo }[] = [];
    for (const periodo of periodos) {
      if (periodo.fecha_fin < fechaMin) break; // periodos vienen fecha_inicio DESC
      const totales = sumarPeriodo(completados, periodo);
      if (totales.count > 0) out.push({ periodo, totales });
    }
    return out;
  }, [turnos, periodos]);

  const totalHistorico = filas.reduce((s, f) => s + f.totales.pago, 0);

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center" edges={['top']}>
        <ActivityIndicator size="large" color={theme.primary} />
      </SafeAreaView>
    );
  }

  if (isError) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center gap-3 px-6" edges={['top']}>
        <Ionicons name="warning-outline" size={48} color="#94A3B8" />
        <Text className="text-base font-semibold text-foreground">
          {apiErrorMessage(error, 'Error al cargar el historial')}
        </Text>
        <Button label="Reintentar" onPress={() => refetch()} variant="secondary" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <FlatList
        data={filas}
        keyExtractor={(item) => String(item.periodo.id)}
        contentContainerClassName="gap-2 pb-8"
        contentContainerStyle={{ paddingHorizontal: 20 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={theme.primary} colors={[theme.primary]} />}
        ListHeaderComponent={
          <View className="pt-2 pb-4 gap-1">
            <Text className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Total histórico</Text>
            <Text className="text-3xl font-extrabold" style={{ color: theme.primary }}>
              {formatCOP(totalHistorico)}
            </Text>
            <Text className="text-xs text-muted-foreground">
              {filas.length} {filas.length === 1 ? 'período' : 'períodos'} con turnos completados
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <View className="bg-card border border-border rounded-2xl px-4 py-3 flex-row items-center justify-between">
            <View className="flex-1 gap-0.5">
              <View className="flex-row items-center gap-1.5">
                <Text className="text-sm font-semibold text-foreground">{fmtPeriodo(item.periodo)}</Text>
                <TipoPeriodoBadge tipo={item.periodo.tipo} />
              </View>
              <Text className="text-xs text-muted-foreground">
                {item.totales.count} {item.totales.count === 1 ? 'turno' : 'turnos'} · {item.totales.horas.toFixed(1)}h
              </Text>
            </View>
            <Text className="text-base font-bold text-foreground">
              {formatCOP(item.totales.pago)}
            </Text>
          </View>
        )}
        ListEmptyComponent={
          <View className="py-16 items-center gap-3 px-8">
            <Ionicons name="bar-chart-outline" size={48} color="#94A3B8" />
            <Text className="text-base font-semibold text-foreground text-center">Sin historial aún</Text>
            <Text className="text-sm text-muted-foreground text-center">
              Cuando completes turnos, aparecerán aquí agrupados por período.
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// trabajador_nomina — historial por período de nómina
// ══════════════════════════════════════════════════════════════════════════

function HistorialNomina() {
  const theme = useTheme();
  const { data: perfil } = useNominaPerfil();
  const valorHora = getValorHora(perfil?.salario_base ?? null);

  const { data: periodosResp, isLoading: loadingPeriodos } = usePeriodos();
  const periodos = periodosResp?.data ?? [];

  const {
    data: registrosResp,
    isLoading: loadingRegistros,
    isError, error, refetch, isRefetching,
  } = useRegistrosHistorial();
  const registros = registrosResp?.data ?? [];

  const filas = useMemo(() => {
    const porPeriodo = new Map<number, RegistroDiario[]>();
    for (const r of registros) {
      const arr = porPeriodo.get(r.periodo_id) ?? [];
      arr.push(r);
      porPeriodo.set(r.periodo_id, arr);
    }
    const out: { periodo: PeriodoNomina; resumen: ResumenPeriodoNomina }[] = [];
    for (const p of periodos) {
      const regs = porPeriodo.get(p.id);
      if (!regs) continue;
      out.push({ periodo: p, resumen: calcularResumenPeriodo(regs, valorHora) });
    }
    return out.sort((a, b) => b.periodo.fecha_inicio.localeCompare(a.periodo.fecha_inicio));
  }, [periodos, registros, valorHora]);

  const totalExtraHistorico = filas.reduce((s, f) => s + f.resumen.valorExtraCOP, 0);
  const isLoading = loadingPeriodos || loadingRegistros;

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center" edges={['top']}>
        <ActivityIndicator size="large" color={theme.primary} />
      </SafeAreaView>
    );
  }

  if (isError) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center gap-3 px-6" edges={['top']}>
        <Ionicons name="warning-outline" size={48} color="#94A3B8" />
        <Text className="text-base font-semibold text-foreground">
          {apiErrorMessage(error, 'Error al cargar el historial')}
        </Text>
        <Button label="Reintentar" onPress={() => refetch()} variant="secondary" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <FlatList
        data={filas}
        keyExtractor={(item) => String(item.periodo.id)}
        contentContainerClassName="gap-2 pb-8"
        contentContainerStyle={{ paddingHorizontal: 20 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={theme.primary} colors={[theme.primary]} />}
        ListHeaderComponent={
          <View className="pt-2 pb-4 gap-3">
            <View className="gap-1">
              <Text className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Salario mensual (fijo)</Text>
              <Text className="text-2xl font-extrabold text-foreground">
                {perfil?.salario_base != null ? formatCOP(perfil.salario_base) : '—'}
              </Text>
            </View>
            <View className="gap-1">
              <Text className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Extras acumulados</Text>
              <Text className="text-2xl font-extrabold" style={{ color: theme.primary }}>
                +{formatCOP(totalExtraHistorico)}
              </Text>
              <Text className="text-xs text-muted-foreground">
                {filas.length} {filas.length === 1 ? 'período con registros' : 'períodos con registros'}
              </Text>
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <View className="bg-card border border-border rounded-2xl px-4 py-3 gap-1.5">
            <View className="flex-row items-center justify-between">
              <Text className="text-sm font-semibold text-foreground">{fmtPeriodo(item.periodo)}</Text>
              <View className="flex-row items-center gap-1.5">
                <PeriodoBadge estado={item.periodo.estado} />
                <TipoPeriodoBadge tipo={item.periodo.tipo} />
              </View>
            </View>
            <View className="flex-row items-center justify-between">
              <Text className="text-xs text-muted-foreground">
                {item.resumen.diasRegistrados} días · {item.resumen.totalHoras.toFixed(1)}h
              </Text>
              <Text className={`text-sm font-bold ${item.resumen.valorExtraCOP > 0 ? 'text-success' : 'text-muted-foreground'}`}>
                {item.resumen.valorExtraCOP > 0 ? `+${formatCOP(item.resumen.valorExtraCOP)}` : '$0 extra'}
              </Text>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <View className="py-16 items-center gap-3 px-8">
            <Ionicons name="bar-chart-outline" size={48} color="#94A3B8" />
            <Text className="text-base font-semibold text-foreground text-center">Sin historial aún</Text>
            <Text className="text-sm text-muted-foreground text-center">
              Cuando se cierren períodos con registros tuyos, aparecerán aquí.
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}
