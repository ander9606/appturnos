/**
 * Vista de quincena para trabajador_turnos.
 * Muestra los turnos completados en el período actual/anterior
 * con el total a cobrar, horas trabajadas y badge de turno extendido.
 */
import React, { useState, useMemo, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { Ionicons } from '@expo/vector-icons';
import { useMisTurnos } from '@/features/turnos/useTurnos';
import { useTheme } from '@/lib/theme';
import type { Asignacion } from '@api-client';

// ── Helpers ───────────────────────────────────────────────────────────────

const SHORT_MONTHS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
const SHORT_DAYS   = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];

interface QuincenaRange {
  inicio: Date;
  fin: Date;
  label: string;
}

function getQuincenaRange(ref: Date): QuincenaRange {
  const day   = ref.getDate();
  const month = ref.getMonth();
  const year  = ref.getFullYear();
  if (day <= 15) {
    return {
      inicio: new Date(year, month, 1),
      fin:    new Date(year, month, 15, 23, 59, 59),
      label:  `1–15 ${SHORT_MONTHS[month]}`,
    };
  }
  const lastDay = new Date(year, month + 1, 0).getDate();
  return {
    inicio: new Date(year, month, 16),
    fin:    new Date(year, month, lastDay, 23, 59, 59),
    label:  `16–${lastDay} ${SHORT_MONTHS[month]}`,
  };
}

function getPrevQuincena(range: QuincenaRange): QuincenaRange {
  const refDate = new Date(range.inicio.getTime() - 24 * 60 * 60 * 1000);
  return getQuincenaRange(refDate);
}

function isExtendido(a: Asignacion): { extendido: boolean; extraMin: number } {
  if (!a.hora_egreso_real || !a.hora_fin_estimada || !a.oferta_fecha) {
    return { extendido: false, extraMin: 0 };
  }
  const finEstimado = new Date(`${a.oferta_fecha}T${a.hora_fin_estimada}`);
  const egresoReal  = new Date(a.hora_egreso_real);
  const extraMin    = Math.round((egresoReal.getTime() - finEstimado.getTime()) / 60000);
  return { extendido: extraMin > 5, extraMin: Math.max(0, extraMin) };
}

function fmtHora(time: string | null): string {
  if (!time) return '—';
  return time.slice(0, 5).replace(/^0/, '');
}

function fmtFecha(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return `${SHORT_DAYS[d.getDay()]} ${d.getDate()} ${SHORT_MONTHS[d.getMonth()]}`;
}

// ── Component ─────────────────────────────────────────────────────────────

export function NominaTurnosView() {
  const theme  = useTheme();
  const router = useRouter();

  const { data: turnos, isLoading, refetch, isRefetching } = useMisTurnos();

  const hoy = useMemo(() => new Date(), []);
  const quincenaActual  = useMemo(() => getQuincenaRange(hoy), [hoy]);
  const quincenaAnterior = useMemo(() => getPrevQuincena(quincenaActual), [quincenaActual]);

  const [showAnterior, setShowAnterior] = useState(false);
  const quincena = showAnterior ? quincenaAnterior : quincenaActual;

  const turnosQuincena = useMemo(() => {
    if (!turnos) return [];
    return turnos.filter((a) => {
      if (a.estado !== 'completado') return false;
      const fecha = new Date(`${a.oferta_fecha}T00:00:00`);
      return fecha >= quincena.inicio && fecha <= quincena.fin;
    });
  }, [turnos, quincena]);

  const totales = useMemo(() =>
    turnosQuincena.reduce(
      (acc, a) => ({
        count: acc.count + 1,
        horas: acc.horas + (Number(a.horas_trabajadas) || 0),
        pago:  acc.pago  + (Number(a.pago_total) || 0),
      }),
      { count: 0, horas: 0, pago: 0 }
    ),
    [turnosQuincena]
  );

  const onRefresh = useCallback(() => { refetch(); }, [refetch]);

  const renderItem = useCallback(({ item }: { item: Asignacion }) => {
    const { extendido, extraMin } = isExtendido(item);
    return (
      <TouchableOpacity
        onPress={() => router.push(`/turno/${item.id}`)}
        className="bg-card rounded-2xl px-4 py-4 gap-2"
        style={{ elevation: 1, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6 }}
        activeOpacity={0.7}
      >
        <View className="flex-row items-start justify-between gap-2">
          <View className="flex-1 gap-0.5">
            <Text className="text-sm font-semibold text-foreground" numberOfLines={1}>
              {item.oferta_titulo}
            </Text>
            {(item as any).empresa_nombre && (
              <Text className="text-xs text-muted-foreground" numberOfLines={1}>
                {(item as any).empresa_nombre}
              </Text>
            )}
          </View>
          {extendido && (
            <View className="bg-warning-light px-2 py-0.5 rounded-full">
              <Text className="text-[10px] font-semibold text-amber-700">
                +{extraMin} min
              </Text>
            </View>
          )}
        </View>

        <View className="flex-row items-center gap-3 flex-wrap">
          <View className="flex-row items-center gap-1">
            <Ionicons name="calendar-outline" size={11} color="#64748B" />
            <Text className="text-xs text-muted-foreground">
              {fmtFecha(item.oferta_fecha)}
            </Text>
          </View>
          <View className="flex-row items-center gap-1">
            <Ionicons name="time-outline" size={11} color="#64748B" />
            <Text className="text-xs text-muted-foreground">
              {fmtHora(item.hora_inicio)} – {fmtHora(item.hora_egreso_real?.slice(11, 19) ?? null)}
            </Text>
          </View>
          {item.horas_trabajadas != null && (
            <View className="flex-row items-center gap-1">
              <Ionicons name="stopwatch-outline" size={11} color="#64748B" />
              <Text className="text-xs text-muted-foreground">
                {Number(item.horas_trabajadas).toFixed(1)}h
              </Text>
            </View>
          )}
        </View>

        <View className="flex-row items-center justify-between mt-1">
          <Text className="text-sm font-bold" style={{ color: theme.primary }}>
            ${(Number(item.pago_total) || 0).toLocaleString('es-CO')}
          </Text>
          {extendido && (
            <Text className="text-xs text-amber-600">Turno extendido</Text>
          )}
        </View>
      </TouchableOpacity>
    );
  }, [router, theme]);

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center" edges={['top']}>
        <ActivityIndicator size="large" color={theme.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <FlatList
        data={turnosQuincena}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
        contentContainerClassName="gap-2 pb-8"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={onRefresh}
            tintColor={theme.primary} colors={[theme.primary]} />
        }
        ListHeaderComponent={
          <View className="gap-4 pb-2">
            {/* ── Header ──────────────────────────────────────────── */}
            <View className="pt-4 pb-6 px-6 rounded-b-[28px] gap-3"
              style={{ backgroundColor: theme.primary }}>
              <Text className="text-white/80 text-xs font-medium uppercase tracking-wide">
                Mis Turnos
              </Text>

              {/* Selector quincena */}
              <View className="flex-row items-center gap-2">
                <TouchableOpacity
                  onPress={() => setShowAnterior(true)}
                  className="px-3 py-1.5 rounded-full border border-white/30"
                  style={showAnterior ? { backgroundColor: 'rgba(255,255,255,0.25)' } : {}}
                >
                  <Text className="text-white text-xs font-medium">
                    {quincenaAnterior.label}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setShowAnterior(false)}
                  className="px-3 py-1.5 rounded-full border border-white/30"
                  style={!showAnterior ? { backgroundColor: 'rgba(255,255,255,0.25)' } : {}}
                >
                  <Text className="text-white text-xs font-medium">
                    {quincenaActual.label}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Resumen cards */}
              <View className="flex-row gap-2 mt-1">
                <View className="flex-1 bg-white/15 rounded-2xl px-3 py-2.5 gap-0.5">
                  <Text className="text-white text-lg font-extrabold">{totales.count}</Text>
                  <Text className="text-white/70 text-[10px]">Turnos</Text>
                </View>
                <View className="flex-1 bg-white/15 rounded-2xl px-3 py-2.5 gap-0.5">
                  <Text className="text-white text-lg font-extrabold">
                    {totales.horas.toFixed(1)}h
                  </Text>
                  <Text className="text-white/70 text-[10px]">Horas</Text>
                </View>
                <View className="flex-[1.4] bg-white/25 rounded-2xl px-3 py-2.5 gap-0.5">
                  <Text className="text-white text-lg font-extrabold">
                    ${totales.pago.toLocaleString('es-CO')}
                  </Text>
                  <Text className="text-white/70 text-[10px]">A cobrar</Text>
                </View>
              </View>
            </View>

            <View className="px-5">
              <Text className="text-sm font-semibold text-foreground">
                Detalle de turnos
              </Text>
            </View>
          </View>
        }
        ListEmptyComponent={
          <View className="py-16 items-center gap-3 px-8">
            <Ionicons name="clipboard-outline" size={48} color="#94A3B8" />
            <Text className="text-base font-semibold text-foreground text-center">
              Sin turnos completados
            </Text>
            <Text className="text-sm text-muted-foreground text-center">
              No tienes turnos completados en el período {quincena.label}.
            </Text>
          </View>
        }
        ItemSeparatorComponent={() => <View className="h-2" />}
        contentContainerStyle={{ paddingHorizontal: 20 }}
      />
    </SafeAreaView>
  );
}
