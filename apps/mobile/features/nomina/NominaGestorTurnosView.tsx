import React, { useState, useMemo, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAsignacionesGestor } from '@/features/turnos/useTurnos';
import { useTheme } from '@/lib/theme';
import type { Asignacion } from '@api-client';

// ── Helpers ───────────────────────────────────────────────────────────────

const SHORT_MONTHS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
const SHORT_DAYS   = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];

interface QuincenaRange {
  inicio: Date;
  fin:    Date;
  label:  string;
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

function fmtFecha(iso: string) {
  const d = new Date(`${iso}T00:00:00`);
  return `${SHORT_DAYS[d.getDay()]} ${d.getDate()} ${SHORT_MONTHS[d.getMonth()]}`;
}

function fmtHora(time: string) {
  return time.slice(0, 5).replace(/^0/, '');
}

// ── Types ─────────────────────────────────────────────────────────────────

interface GrupoTrabajador {
  trabajador_id: number;
  nombre: string;
  cargo_nombre: string | undefined;
  turnos: Asignacion[];
  totalHoras: number;
  totalPago: number;
}

// ── ShiftMiniRow ──────────────────────────────────────────────────────────

function ShiftMiniRow({ turno, primaryColor }: { turno: Asignacion; primaryColor: string }) {
  return (
    <View className="flex-row items-start justify-between py-2 border-b border-border last:border-b-0">
      <View className="flex-1 mr-3 gap-0.5">
        <Text className="text-xs font-medium text-foreground" numberOfLines={1}>
          {turno.oferta_titulo}
        </Text>
        <Text className="text-[11px] text-muted-foreground">
          📅 {fmtFecha(turno.oferta_fecha)}{'  '}🕐 {fmtHora(turno.hora_inicio)}
          {turno.horas_trabajadas != null ? `  ⏱ ${turno.horas_trabajadas.toFixed(1)}h` : ''}
        </Text>
      </View>
      <Text className="text-xs font-bold" style={{ color: primaryColor }}>
        ${(turno.pago_total ?? 0).toLocaleString('es-CO')}
      </Text>
    </View>
  );
}

// ── GrupoTrabajadorRow ────────────────────────────────────────────────────

function GrupoTrabajadorRow({ grupo, primaryColor }: { grupo: GrupoTrabajador; primaryColor: string }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <View
      className="bg-card rounded-2xl overflow-hidden"
      style={{ elevation: 1, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6 }}
    >
      <TouchableOpacity
        className="px-4 py-4 gap-1"
        onPress={() => setExpanded((v) => !v)}
        activeOpacity={0.75}
      >
        <View className="flex-row items-center justify-between">
          <View className="flex-1 mr-2">
            <Text className="text-sm font-semibold text-foreground">{grupo.nombre}</Text>
            {grupo.cargo_nombre ? (
              <Text className="text-xs text-muted-foreground">{grupo.cargo_nombre}</Text>
            ) : null}
          </View>
          <Text className="text-lg text-muted-foreground">{expanded ? '▲' : '▼'}</Text>
        </View>

        <View className="flex-row gap-4 mt-0.5">
          <View className="gap-0.5">
            <Text className="text-sm font-bold text-foreground">{grupo.turnos.length}</Text>
            <Text className="text-[10px] text-muted-foreground">Turnos</Text>
          </View>
          <View className="gap-0.5">
            <Text className="text-sm font-bold text-foreground">{grupo.totalHoras.toFixed(1)}h</Text>
            <Text className="text-[10px] text-muted-foreground">Horas</Text>
          </View>
          <View className="gap-0.5">
            <Text className="text-sm font-bold" style={{ color: primaryColor }}>
              ${grupo.totalPago.toLocaleString('es-CO')}
            </Text>
            <Text className="text-[10px] text-muted-foreground">Total</Text>
          </View>
        </View>
      </TouchableOpacity>

      {expanded && (
        <View className="px-4 pb-3 border-t border-border">
          {grupo.turnos.map((t) => (
            <ShiftMiniRow key={t.id} turno={t} primaryColor={primaryColor} />
          ))}
        </View>
      )}
    </View>
  );
}

// ── NominaGestorTurnosView ────────────────────────────────────────────────

export function NominaGestorTurnosView() {
  const theme = useTheme();

  const { data: resp, isLoading, isError, refetch, isRefetching } = useAsignacionesGestor();

  const hoy = useMemo(() => new Date(), []);
  const quincenaActual   = useMemo(() => getQuincenaRange(hoy), [hoy]);
  const quincenaAnterior = useMemo(() => getPrevQuincena(quincenaActual), [quincenaActual]);

  const [showAnterior, setShowAnterior] = useState(false);
  const quincena = showAnterior ? quincenaAnterior : quincenaActual;

  const grupos = useMemo<GrupoTrabajador[]>(() => {
    const asignaciones = resp?.data ?? [];
    const filtradas = asignaciones.filter((a) => {
      if (a.estado !== 'completado') return false;
      const fecha = new Date(`${a.oferta_fecha}T00:00:00`);
      return fecha >= quincena.inicio && fecha <= quincena.fin;
    });

    const map = new Map<number, GrupoTrabajador>();
    for (const a of filtradas) {
      const existing = map.get(a.trabajador_id);
      if (existing) {
        existing.turnos.push(a);
        existing.totalHoras += a.horas_trabajadas ?? 0;
        existing.totalPago  += a.pago_total ?? 0;
      } else {
        map.set(a.trabajador_id, {
          trabajador_id: a.trabajador_id,
          nombre:        `${a.trabajador_nombre ?? ''} ${a.trabajador_apellido ?? ''}`.trim(),
          cargo_nombre:  a.cargo_nombre,
          turnos:        [a],
          totalHoras:    a.horas_trabajadas ?? 0,
          totalPago:     a.pago_total ?? 0,
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => b.totalPago - a.totalPago);
  }, [resp, quincena]);

  const totales = useMemo(
    () => grupos.reduce(
      (acc, g) => ({ turnos: acc.turnos + g.turnos.length, horas: acc.horas + g.totalHoras, pago: acc.pago + g.totalPago }),
      { turnos: 0, horas: 0, pago: 0 }
    ),
    [grupos]
  );

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
        <Text className="text-4xl">⚠️</Text>
        <Text className="text-base font-semibold text-foreground text-center">Error al cargar datos</Text>
        <TouchableOpacity
          onPress={() => refetch()}
          className="bg-card border border-border px-5 py-2.5 rounded-2xl"
        >
          <Text className="text-sm font-medium text-foreground">Reintentar</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <FlatList
        data={grupos}
        keyExtractor={(item) => String(item.trabajador_id)}
        renderItem={({ item }) => (
          <GrupoTrabajadorRow grupo={item} primaryColor={theme.primary} />
        )}
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
                Pagos por Turnos
              </Text>

              {/* Quincena selector */}
              <View className="flex-row items-center gap-2">
                <TouchableOpacity
                  onPress={() => setShowAnterior(true)}
                  className="px-3 py-1.5 rounded-full border border-white/30"
                  style={showAnterior ? { backgroundColor: 'rgba(255,255,255,0.25)' } : {}}
                >
                  <Text className="text-white text-xs font-medium">{quincenaAnterior.label}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setShowAnterior(false)}
                  className="px-3 py-1.5 rounded-full border border-white/30"
                  style={!showAnterior ? { backgroundColor: 'rgba(255,255,255,0.25)' } : {}}
                >
                  <Text className="text-white text-xs font-medium">{quincenaActual.label}</Text>
                </TouchableOpacity>
              </View>

              {/* Summary cards */}
              <View className="flex-row gap-2 mt-1">
                <View className="flex-1 bg-white/15 rounded-2xl px-3 py-2.5 gap-0.5">
                  <Text className="text-white text-lg font-extrabold">{totales.turnos}</Text>
                  <Text className="text-white/70 text-[10px]">Turnos</Text>
                </View>
                <View className="flex-1 bg-white/15 rounded-2xl px-3 py-2.5 gap-0.5">
                  <Text className="text-white text-lg font-extrabold">{totales.horas.toFixed(1)}h</Text>
                  <Text className="text-white/70 text-[10px]">Horas</Text>
                </View>
                <View className="flex-[1.4] bg-white/25 rounded-2xl px-3 py-2.5 gap-0.5">
                  <Text className="text-white text-lg font-extrabold">
                    ${totales.pago.toLocaleString('es-CO')}
                  </Text>
                  <Text className="text-white/70 text-[10px]">Total pagado</Text>
                </View>
              </View>
            </View>

            <View className="px-5">
              <Text className="text-sm font-semibold text-foreground">Por empleado</Text>
            </View>
          </View>
        }
        ListEmptyComponent={
          <View className="py-16 items-center gap-3 px-8">
            <Text className="text-4xl">📋</Text>
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
