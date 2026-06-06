import React, { useState, useMemo, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { useLiquidacionTurnos } from '@/features/turnos/useTurnos';
import { useTheme } from '@/lib/theme';
import { toISODate, formatCOP } from '@/lib/formatters';
import { getQuincena, getPrevQuincena } from './quincenaUtils';
import { LiquidacionTrabajadorCard } from './LiquidacionTrabajadorCard';

export function NominaGestorTurnosView() {
  const theme = useTheme();

  const hoy              = useMemo(() => new Date(), []);
  const quincenaActual   = useMemo(() => getQuincena(hoy), [hoy]);
  const quincenaAnterior = useMemo(() => getPrevQuincena(quincenaActual), [quincenaActual]);

  const [showAnterior, setShowAnterior] = useState(false);
  const quincena = showAnterior ? quincenaAnterior : quincenaActual;

  const fechaInicio = useMemo(() => toISODate(quincena.inicio), [quincena]);
  const fechaFin    = useMemo(() => toISODate(quincena.fin),    [quincena]);

  const { data, isLoading, isError, refetch, isRefetching } = useLiquidacionTurnos({
    fecha_inicio: fechaInicio,
    fecha_fin:    fechaFin,
  });

  const trabajadores = data ?? [];

  const totales = useMemo(() => trabajadores.reduce(
    (acc, w) => ({
      trabajadores: acc.trabajadores + 1,
      turnos:       acc.turnos + w.total_turnos,
      horas:        acc.horas  + Number(w.total_horas),
      pago:         acc.pago   + Number(w.pago_total),
      extra:        acc.extra  + Number(w.pago_extra),
    }),
    { trabajadores: 0, turnos: 0, horas: 0, pago: 0, extra: 0 }
  ), [trabajadores]);

  const onRefresh = useCallback(() => { refetch(); }, [refetch]);

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center" edges={['top']}>
        <ActivityIndicator size="large" color={theme.primary} />
      </SafeAreaView>
    );
  }

  if (isError) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center gap-3 px-8" edges={['top']}>
        <Ionicons name="warning-outline" size={48} color="#94A3B8" />
        <Text className="text-base font-semibold text-foreground text-center">Error al cargar datos</Text>
        <TouchableOpacity onPress={() => refetch()} className="bg-card border border-border px-5 py-2.5 rounded-2xl">
          <Text className="text-sm font-medium text-foreground">Reintentar</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <FlatList
        data={trabajadores}
        keyExtractor={(item) => String(item.trabajador_id)}
        renderItem={({ item }) => (
          <LiquidacionTrabajadorCard trabajador={item} primaryColor={theme.primary} />
        )}
        contentContainerClassName="gap-2 pb-8"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={onRefresh}
            tintColor={theme.primary} colors={[theme.primary]} />
        }
        ListHeaderComponent={
          <View className="gap-4 pb-2">
            <View className="pt-4 pb-6 px-6 rounded-b-[28px] gap-3"
              style={{ backgroundColor: theme.primary }}>
              <Text className="text-white/80 text-xs font-medium uppercase tracking-wide">
                Liquidación de Turnos
              </Text>

              {/* Selector quincena */}
              <View className="flex-row items-center gap-2">
                {[true, false].map((esAnterior) => {
                  const q     = esAnterior ? quincenaAnterior : quincenaActual;
                  const activa = showAnterior === esAnterior;
                  return (
                    <TouchableOpacity
                      key={String(esAnterior)}
                      onPress={() => setShowAnterior(esAnterior)}
                      className="px-3 py-1.5 rounded-full border border-white/30"
                      style={activa ? { backgroundColor: 'rgba(255,255,255,0.25)' } : {}}
                    >
                      <Text className="text-white text-xs font-medium">{q.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Resumen */}
              <View className="flex-row gap-2 mt-1">
                <View className="flex-1 bg-white/15 rounded-2xl px-3 py-2.5 gap-0.5">
                  <Text className="text-white text-lg font-extrabold">{totales.turnos}</Text>
                  <Text className="text-white/70 text-[10px]">Turnos</Text>
                </View>
                <View className="flex-1 bg-white/15 rounded-2xl px-3 py-2.5 gap-0.5">
                  <Text className="text-white text-lg font-extrabold">{totales.horas.toFixed(1)}h</Text>
                  <Text className="text-white/70 text-[10px]">Horas</Text>
                </View>
                <View className="flex-[1.6] bg-white/25 rounded-2xl px-3 py-2.5 gap-0.5">
                  <Text className="text-white text-lg font-extrabold">
                    {formatCOP(totales.pago)}
                  </Text>
                  <Text className="text-white/70 text-[10px]">
                    {totales.extra > 0 ? `+${formatCOP(totales.extra)} extra` : 'Total a pagar'}
                  </Text>
                </View>
              </View>
            </View>

            {trabajadores.length > 0 && (
              <View className="px-5 flex-row items-center justify-between">
                <Text className="text-sm font-semibold text-foreground">
                  {totales.trabajadores} empleado{totales.trabajadores !== 1 ? 's' : ''}
                </Text>
                <Text className="text-xs text-muted-foreground">Toca para ver detalle</Text>
              </View>
            )}
          </View>
        }
        ListEmptyComponent={
          <View className="py-16 items-center gap-3 px-8">
            <Ionicons name="clipboard-outline" size={48} color="#94A3B8" />
            <Text className="text-base font-semibold text-foreground text-center">
              Sin turnos completados
            </Text>
            <Text className="text-sm text-muted-foreground text-center">
              No hay turnos completados en el período {quincena.label}.
            </Text>
          </View>
        }
        ItemSeparatorComponent={() => <View className="h-2" />}
        contentContainerStyle={{ paddingHorizontal: 20 }}
      />
    </SafeAreaView>
  );
}
