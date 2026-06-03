import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useRouter } from 'expo-router';
import { useAuthStore } from '@/features/auth/useAuthStore';
import { useTheme }     from '@/lib/theme';
import { useMisTurnos, useOfertas, useAplicar, usePostulacionesPendientes } from '@/features/turnos/useTurnos';
import { WeekStrip }  from '@/features/turnos/WeekStrip';
import { ShiftCard }  from '@/features/turnos/ShiftCard';
import { GestorTurnosView } from '@/features/turnos/GestorTurnosView';
import { getWeekDays, toISODate } from '@/features/turnos/turnosUtils';
import { Ionicons } from '@expo/vector-icons';
import { Badge }   from '@/components/ui/Badge';
import { Button }  from '@/components/ui/Button';
import type { Asignacion, Oferta } from '@api-client';

// ── Constants ─────────────────────────────────────────────────────────────

type ActiveTab = 'mis_turnos' | 'disponibles';

// ── Screen ────────────────────────────────────────────────────────────────

export default function TurnosScreen() {
  const rol      = useAuthStore((s) => s.usuario?.rol);
  const isWorker = rol === 'trabajador_turnos';
  const isGestor = rol === 'jefe_turnos' || rol === 'admin_empresa';
  const theme    = useTheme();
  const today    = useMemo(() => toISODate(new Date()), []);

  const [weekRef,      setWeekRef]      = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState<string>(today);
  const [activeTab,    setActiveTab]    = useState<ActiveTab>(() => isWorker ? 'mis_turnos' : 'disponibles');

  const weekDays  = useMemo(() => getWeekDays(weekRef), [weekRef]);
  const weekLabel = useMemo(() => buildWeekLabel(weekDays), [weekDays]);

  const goToPrevWeek = useCallback(() => {
    setWeekRef((prev: Date) => {
      const d = new Date(prev);
      d.setDate(d.getDate() - 7);
      const days = getWeekDays(d);
      const todayDay = days.find(day => day.isoDate === today);
      setSelectedDate(todayDay ? today : days[0].isoDate);
      return d;
    });
  }, [today]);

  const goToNextWeek = useCallback(() => {
    setWeekRef((prev: Date) => {
      const d = new Date(prev);
      d.setDate(d.getDate() + 7);
      const days = getWeekDays(d);
      const todayDay = days.find(day => day.isoDate === today);
      setSelectedDate(todayDay ? today : days[0].isoDate);
      return d;
    });
  }, [today]);

  // ── Data ──────────────────────────────────────────────────────────────
  const {
    data: misTurnos,
    isLoading: loadingMios,
    isError: errorMios,
    refetch: refetchMios,
    isRefetching: refetchingMios,
  } = useMisTurnos({ enabled: isWorker });

  const { data: pendientesResp } = usePostulacionesPendientes({ enabled: isGestor });
  const pendientesCount = pendientesResp?.data?.length ?? 0;

  const {
    data: ofertasResp,
    isLoading: loadingOfertas,
    refetch: refetchOfertas,
    isRefetching: refetchingOfertas,
  } = useOfertas({ disponibles: true });

  const router = useRouter();
  const aplicarMutation = useAplicar();

  // ── Derived ───────────────────────────────────────────────────────────

  /** Días del trabajador que tienen al menos una asignación */
  const datesWithShifts = useMemo(() => {
    const set = new Set<string>();
    misTurnos?.forEach((a) => set.add(a.oferta_fecha));
    return set;
  }, [misTurnos]);

  /** Asignaciones del día seleccionado */
  const turnosDelDia = useMemo(() => {
    if (!misTurnos) return [];
    return misTurnos.filter((a) => a.oferta_fecha === selectedDate);
  }, [misTurnos, selectedDate]);

  /** IDs de ofertas a las que ya está postulado */
  const aplicadosIds = useMemo(() => {
    const set = new Set<number>();
    misTurnos?.forEach((a) => set.add(a.oferta_id));
    return set;
  }, [misTurnos]);

  const ofertas = ofertasResp?.data ?? [];

  const isRefreshing = refetchingMios || refetchingOfertas;

  const onRefresh = useCallback(() => {
    refetchMios();
    refetchOfertas();
  }, []);

  // ── Render helpers ────────────────────────────────────────────────────

  const renderShiftCard = useCallback(({ item }: { item: Asignacion }) => (
    <ShiftCard
      asignacion={item}
      showDate={false}
      onPress={() => router.push(`/turno/${item.id}`)}
    />
  ), []);

  const renderOfertaCard = useCallback(({ item }: { item: Oferta }) => {
    const yaAplicado = aplicadosIds.has(item.id);
    const plazasLibres = item.puestos?.reduce((s, p) => s + (p.plazas - p.plazas_cubiertas), 0) ?? 0;
    const tarifaMin = item.puestos?.length > 0 ? Math.min(...item.puestos.map(p => p.tarifa_dia)) : 0;
    const hayVariasTarifas = item.puestos?.length > 1 && item.puestos.some(p => p.tarifa_dia !== tarifaMin);
    const firstAvailablePuesto = item.puestos?.find(p => p.plazas_cubiertas < p.plazas);

    return (
      <View
        className="bg-card rounded-2xl overflow-hidden flex-row"
        style={{
          elevation: 2,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.06,
          shadowRadius: 8,
        }}
      >
        {/* Accent bar */}
        <View className="w-1.5 bg-primary-400" />

        <View className="flex-1 px-4 py-4 gap-2">
          <View className="flex-row items-start justify-between gap-2">
            <Text className="text-base font-semibold text-foreground flex-1" numberOfLines={1}>
              {item.titulo}
            </Text>
            {plazasLibres <= 2 && plazasLibres > 0 && (
              <Badge label={`${plazasLibres} plaza${plazasLibres > 1 ? 's' : ''}`} variant="warning" size="sm" />
            )}
          </View>

          <View className="flex-row gap-3 flex-wrap">
            <View className="flex-row items-center gap-1">
              <Ionicons name="calendar-outline" size={13} color="#64748B" />
              <Text className="text-sm text-muted-foreground">
                {formatShortDate(item.fecha)}
              </Text>
            </View>
            <View className="flex-row items-center gap-1">
              <Ionicons name="time-outline" size={13} color="#64748B" />
              <Text className="text-sm text-muted-foreground">
                {fmtRangeSimple(item.hora_inicio, item.hora_fin_estimada)}
              </Text>
            </View>
            {item.lugar && (
              <View className="flex-row items-center gap-1 flex-1">
                <Ionicons name="location-outline" size={13} color="#64748B" />
                <Text className="text-sm text-muted-foreground" numberOfLines={1}>
                  {item.lugar}
                </Text>
              </View>
            )}
          </View>

          <View className="flex-row items-center justify-between mt-1">
            <Text className="text-sm font-semibold text-success">
              {hayVariasTarifas ? 'Desde ' : ''}${tarifaMin.toLocaleString('es-CO')} / día
            </Text>
            {yaAplicado ? (
              <Badge label="Ya postulado" variant="info" size="sm" />
            ) : (
              <Button
                label={aplicarMutation.isPending ? 'Aplicando…' : 'Aplicar'}
                variant="primary"
                size="sm"
                loading={aplicarMutation.isPending}
                disabled={!firstAvailablePuesto}
                onPress={() => firstAvailablePuesto && aplicarMutation.mutate({ ofertaId: item.id, puestoId: firstAvailablePuesto.id })}
              />
            )}
          </View>
        </View>
      </View>
    );
  }, [aplicadosIds, aplicarMutation]);

  // ── Empty states ──────────────────────────────────────────────────────

  const EmptyMiosTurnos = () => (
    <View className="flex-1 items-center justify-center py-16 gap-3">
      <Ionicons name="calendar-outline" size={48} color="#94A3B8" />
      <Text className="text-base font-semibold text-foreground">Sin turnos este día</Text>
      <Text className="text-sm text-muted-foreground text-center px-8">
        No tienes turnos asignados el{' '}
        {formatShortDate(selectedDate)}.
      </Text>
    </View>
  );

  const EmptyOfertas = () => (
    <View className="flex-1 items-center justify-center py-16 gap-3">
      <Ionicons name="search-outline" size={48} color="#94A3B8" />
      <Text className="text-base font-semibold text-foreground">Sin ofertas disponibles</Text>
      <Text className="text-sm text-muted-foreground text-center px-8">
        No hay turnos disponibles en este momento. Vuelve más tarde.
      </Text>
    </View>
  );

  // ── Main render ───────────────────────────────────────────────────────

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>

      {/* ── Header ─────────────────────────────────────────────────── */}
      <View className="bg-card px-6 pt-4 pb-0 border-b border-border flex-row items-center justify-between">
        <Text className="text-xl font-bold text-foreground">
          {isGestor ? 'Gestión de Turnos' : 'Mis Turnos'}
        </Text>
        {isGestor ? (
          <TouchableOpacity
            onPress={() => router.push('/liquidacion-turnos')}
            className="flex-row items-center gap-1.5 bg-primary-500 px-3 py-1.5 rounded-xl"
            accessibilityLabel="Ver liquidación"
          >
            <Ionicons name="cash-outline" size={15} color="#fff" />
            <Text className="text-white text-sm font-semibold">Liquidar</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            className="w-9 h-9 bg-primary-500 rounded-xl items-center justify-center"
            accessibilityLabel="Nuevo turno"
          >
            <Text className="text-white text-xl font-bold">+</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ── Week strip ─────────────────────────────────────────────── */}
      <WeekStrip
        days={weekDays}
        selectedDate={selectedDate}
        datesWithShifts={datesWithShifts}
        onSelectDate={setSelectedDate}
        weekLabel={weekLabel}
        onPrevWeek={goToPrevWeek}
        onNextWeek={goToNextWeek}
        primaryColor={theme.primary}
      />

      {/* ── Gestor view ────────────────────────────────────────────── */}
      {isGestor ? (
        <View className="flex-1">
          <GestorTurnosView selectedDate={selectedDate} />

          {/* FAB — acceso a todas las postulaciones */}
          <TouchableOpacity
            onPress={() => router.push('/postulaciones')}
            activeOpacity={0.85}
            style={{
              position: 'absolute',
              bottom: 24,
              right: 20,
              width: 56,
              height: 56,
              borderRadius: 28,
              backgroundColor: theme.primary,
              alignItems: 'center',
              justifyContent: 'center',
              elevation: 6,
              shadowColor: theme.primary,
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.35,
              shadowRadius: 8,
            }}
            accessibilityLabel="Ver postulaciones"
          >
            <Ionicons name="people" size={24} color="#fff" />
            {pendientesCount > 0 && (
              <View style={{
                position: 'absolute',
                top: -4,
                right: -4,
                minWidth: 20,
                height: 20,
                borderRadius: 10,
                backgroundColor: '#EF4444',
                alignItems: 'center',
                justifyContent: 'center',
                paddingHorizontal: 4,
                borderWidth: 2,
                borderColor: '#fff',
              }}>
                <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700', lineHeight: 13 }}>
                  {pendientesCount > 99 ? '99+' : pendientesCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      ) : (
        <>
          {/* ── Tab selector ─────────────────────────────────────── */}
          {isWorker && (
            <View className="bg-card flex-row border-b border-border px-6">
              {(['mis_turnos', 'disponibles'] as ActiveTab[]).map((tab) => {
                const label = tab === 'mis_turnos' ? 'Mis Turnos' : 'Disponibles';
                const isActive = activeTab === tab;
                return (
                  <TouchableOpacity
                    key={tab}
                    onPress={() => setActiveTab(tab)}
                    className={`py-3 mr-6 border-b-2 ${isActive ? 'border-primary-500' : 'border-transparent'}`}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: isActive }}
                  >
                    <Text className={`text-sm font-semibold ${isActive ? 'text-primary-500' : 'text-muted-foreground'}`}>
                      {label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* ── Worker list ──────────────────────────────────────── */}
          {(!isWorker || activeTab === 'mis_turnos') ? (
            loadingMios ? (
              <View className="flex-1 items-center justify-center">
                <ActivityIndicator size="large" color={theme.primary} />
              </View>
            ) : errorMios ? (
              <View className="flex-1 items-center justify-center gap-3 px-6">
                <Ionicons name="warning-outline" size={48} color="#94A3B8" />
                <Text className="text-base font-semibold text-foreground">Error al cargar turnos</Text>
                <Button label="Reintentar" onPress={() => refetchMios()} variant="secondary" />
              </View>
            ) : (
              <FlatList
                data={turnosDelDia}
                keyExtractor={(item) => String(item.id)}
                renderItem={renderShiftCard}
                contentContainerClassName="px-5 py-4 gap-3"
                ListEmptyComponent={<EmptyMiosTurnos />}
                refreshControl={
                  <RefreshControl
                    refreshing={isRefreshing}
                    onRefresh={onRefresh}
                    tintColor={theme.primary}
                    colors={[theme.primary]}
                  />
                }
                showsVerticalScrollIndicator={false}
              />
            )
          ) : (
            loadingOfertas ? (
              <View className="flex-1 items-center justify-center">
                <ActivityIndicator size="large" color={theme.primary} />
              </View>
            ) : (
              <FlatList
                data={ofertas}
                keyExtractor={(item) => String(item.id)}
                renderItem={renderOfertaCard}
                contentContainerClassName="px-5 py-4 gap-3"
                ListEmptyComponent={<EmptyOfertas />}
                refreshControl={
                  <RefreshControl
                    refreshing={isRefreshing}
                    onRefresh={onRefresh}
                    tintColor={theme.primary}
                    colors={[theme.primary]}
                  />
                }
                showsVerticalScrollIndicator={false}
              />
            )
          )}
        </>
      )}
    </SafeAreaView>
  );
}

// ── Local helpers ─────────────────────────────────────────────────────────

const SHORT_DAYS   = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const SHORT_MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const FULL_MONTHS  = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

import type { WeekDay } from '@/features/turnos/turnosUtils';

function buildWeekLabel(days: WeekDay[]): string {
  const first = days[0];
  const last  = days[6];
  const year  = first.date.getFullYear();
  const thisYear = new Date().getFullYear();
  const yearSuffix = year !== thisYear ? ` ${year}` : '';

  if (first.date.getMonth() === last.date.getMonth()) {
    return `${FULL_MONTHS[first.date.getMonth()]}${yearSuffix}`;
  }
  return `${first.dayNum} ${SHORT_MONTHS[first.date.getMonth()]} – ${last.dayNum} ${SHORT_MONTHS[last.date.getMonth()]}${yearSuffix}`;
}

function formatShortDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return `${SHORT_DAYS[d.getDay()]} ${d.getDate()} ${SHORT_MONTHS[d.getMonth()]}`;
}

function fmtRangeSimple(start: string, end: string | null): string {
  const s = start.slice(0, 5).replace(/^0/, '');
  if (!end) return s;
  return `${s} – ${end.slice(0, 5).replace(/^0/, '')}`;
}
