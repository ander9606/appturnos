import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useRouter } from 'expo-router';
import { useAuthStore } from '@/features/auth/useAuthStore';
import { useTheme }     from '@/lib/theme';
import { useMisTurnos, useOfertas, useAplicar, usePostulacionesPendientes, useLiquidacionTurnos } from '@/features/turnos/useTurnos';
import { usePeriodosEventual } from '@/features/turnos/useTurnosEventual';
import { useNominaPerfil } from '@/features/nomina/useNomina';
import { WeekStrip }  from '@/features/turnos/WeekStrip';
import { ShiftCard }  from '@/features/turnos/ShiftCard';
import { GestorTurnosView } from '@/features/turnos/GestorTurnosView';
import { getDateRange, toISODate, bogotaToday } from '@/features/turnos/turnosUtils';
import { Ionicons } from '@expo/vector-icons';
import { Badge }   from '@/components/ui/Badge';
import { Button }  from '@/components/ui/Button';
import { MonthCalendar } from '@/components/ui/MonthCalendar';
import { getMonthGrid, shiftMonth, MESES_LARGOS, type CalendarDay } from '@/lib/calendar';
import type { Asignacion, Oferta } from '@api-client';
import { apiErrorMessage } from '@/lib/apiErrorMessage';

// ── Constants ─────────────────────────────────────────────────────────────

type ActiveTab = 'mis_turnos' | 'disponibles';

// ── Screen ────────────────────────────────────────────────────────────────

export default function TurnosScreen() {
  const rol           = useAuthStore((s) => s.usuario?.rol);
  const isGestor      = rol === 'jefe_turnos' || rol === 'admin_empresa' || rol === 'jefe_nomina';
  const isJefeNomina  = rol === 'jefe_nomina';
  const isNomina      = rol === 'trabajador_nomina';
  const theme    = useTheme();
  const today    = useMemo(() => bogotaToday(), []);

  const { data: nominaPerfil } = useNominaPerfil(isNomina);
  // trabajador_nomina siempre ve sus turnos eventuales; trabajador_turnos también
  const isWorker = rol === 'trabajador_turnos' || isNomina;

  const [selectedDate, setSelectedDate] = useState<string>(today);
  const [activeTab,    setActiveTab]    = useState<ActiveTab>(() => isWorker ? 'mis_turnos' : 'disponibles');
  const [searchOfertas, setSearchOfertas] = useState('');

  // Vista mensual (solo gestores) — alterna con la lista/WeekStrip por día.
  const [viewMode, setViewMode] = useState<'lista' | 'mes'>('lista');
  const [mesCursor, setMesCursor] = useState(() => {
    const [y, m] = today.split('-').map(Number);
    return { year: y, month: m };
  });
  const mesWeeks = useMemo(() => getMonthGrid(mesCursor.year, mesCursor.month), [mesCursor]);
  const { data: ofertasMesResp, isLoading: loadingOfertasMes } = useOfertas(
    {
      fecha_desde: mesWeeks[0][0].date,
      fecha_hasta: mesWeeks[mesWeeks.length - 1][6].date,
      limit: 300,
      para_quien: isJefeNomina ? 'nomina' : undefined,
      disponibles: isWorker ? true : undefined,
    },
    { enabled: (isGestor || isWorker) && viewMode === 'mes' },
  );
  const ofertasPorDiaMes = useMemo(() => {
    const map = new Map<string, Oferta[]>();
    for (const o of ofertasMesResp?.data ?? []) {
      const lista = map.get(o.fecha) ?? [];
      lista.push(o);
      map.set(o.fecha, lista);
    }
    return map;
  }, [ofertasMesResp]);

  // ponytail: static range, no pagination state needed
  const allDays = useMemo(() => getDateRange(7, 42), []);

  // ── Data ──────────────────────────────────────────────────────────────
  const {
    data: misTurnos,
    isLoading: loadingMios,
    isError: errorMios,
    error: errMios,
    refetch: refetchMios,
    isRefetching: refetchingMios,
  } = useMisTurnos({ enabled: isWorker });

  // Backend restringe GET /asignaciones/postulaciones-pendientes a admin_empresa/jefe_turnos (no jefe_nomina).
  const { data: pendientesResp } = usePostulacionesPendientes({ enabled: isGestor && !isJefeNomina });
  const { data: periodosEventual } = usePeriodosEventual(isNomina);
  const periodoEventual = periodosEventual?.nomina;
  const pendientesCount = pendientesResp?.data?.length ?? 0;

  /** Postulantes pendientes por oferta — para resaltar en el calendario del gestor. */
  const pendientesPorOferta = useMemo(() => {
    const map = new Map<number, number>();
    for (const a of pendientesResp?.data ?? []) {
      map.set(a.oferta_id, (map.get(a.oferta_id) ?? 0) + 1);
    }
    return map;
  }, [pendientesResp]);

  // Saldo a pagar del mes en curso — solo para quien gestiona pagos de turnos.
  const inicioMes = `${today.slice(0, 7)}-01`;
  const { data: liquidacionMes } = useLiquidacionTurnos(
    { fecha_inicio: inicioMes, fecha_fin: today },
    { enabled: isGestor && !isJefeNomina },
  );
  const totalAPagarMes = (liquidacionMes ?? []).reduce((s, w) => s + w.pago_total, 0);

  // Backend excluye 'nomina' de GET /ofertas.
  const {
    data: ofertasResp,
    isLoading: loadingOfertas,
    isError: errorOfertas,
    error: errOfertas,
    refetch: refetchOfertas,
    isRefetching: refetchingOfertas,
  } = useOfertas({ disponibles: true }, { enabled: rol !== 'nomina' });

  const router = useRouter();
  const aplicarMutation = useAplicar();

  // ── Derived ───────────────────────────────────────────────────────────

  /** Días que tienen al menos un turno (propio) o una oferta disponible */
  const datesWithShifts = useMemo(() => {
    const set = new Set<string>();
    misTurnos?.forEach((a) => set.add(a.oferta_fecha));
    ofertasResp?.data?.forEach((o) => set.add(o.fecha));
    return set;
  }, [misTurnos, ofertasResp]);

  /** Mis turnos del mes visible, agrupados por fecha — para los puntos del calendario mensual. */
  const misTurnosPorDiaMes = useMemo(() => {
    const map = new Map<string, Asignacion[]>();
    (misTurnos ?? []).forEach((a) => {
      const lista = map.get(a.oferta_fecha) ?? [];
      lista.push(a);
      map.set(a.oferta_fecha, lista);
    });
    return map;
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

  /** Asignaciones confirmadas/en curso del trabajador (para detectar traslapes) */
  const turnosConfirmados = useMemo(
    () => (misTurnos ?? []).filter((a) => a.estado === 'confirmado' || a.estado === 'en_progreso'),
    [misTurnos],
  );

  const ofertas = ofertasResp?.data ?? [];

  const ofertasFiltradas = useMemo(() => {
    const term = searchOfertas.trim().toLowerCase();
    return ofertas
      .filter((o) => o.fecha === selectedDate)
      .filter((o) => {
        if (!term) return true;
        return (
          o.titulo.toLowerCase().includes(term) ||
          (o.empresa_nombre?.toLowerCase().includes(term) ?? false) ||
          (o.lugar?.toLowerCase().includes(term) ?? false) ||
          (o.puestos ?? []).some((p) => p.cargo_nombre.toLowerCase().includes(term))
        );
      });
  }, [ofertas, searchOfertas, selectedDate]);

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
    const esPasado = item.fecha < today;
    const yaAplicado = aplicadosIds.has(item.id);
    const plazasLibres = item.puestos?.reduce((s, p) => s + (p.plazas - p.plazas_cubiertas), 0) ?? 0;
    const tarifaMin = item.puestos?.length > 0 ? Math.min(...item.puestos.map(p => p.tarifa_dia)) : 0;
    const hayVariasTarifas = item.puestos?.length > 1 && item.puestos.some(p => p.tarifa_dia !== tarifaMin);
    const puestosDisponibles = item.puestos?.filter(p => p.plazas_cubiertas < p.plazas) ?? [];
    const firstAvailablePuesto = puestosDisponibles[0];
    const hayVariosCargos = puestosDisponibles.length > 1;
    const hayTraslape = !esPasado && turnosSolapan(item, turnosConfirmados);

    return (
      <TouchableOpacity
        onPress={() => router.push(`/oferta/${item.id}` as any)}
        activeOpacity={0.8}
        className="bg-card rounded-2xl overflow-hidden flex-row"
        style={{
          elevation: esPasado ? 0 : 2,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: esPasado ? 0 : 0.06,
          shadowRadius: 8,
          opacity: esPasado ? 0.65 : 1,
        }}
      >
        {/* Accent bar */}
        <View
          className="w-1.5"
          style={{ backgroundColor: esPasado ? '#CBD5E1' : hayTraslape ? '#F59E0B' : '#FF7150' }}
        />

        <View className="flex-1 px-4 py-4 gap-2">
          {item.empresa_nombre && (
            <View className="flex-row items-center gap-1">
              <Ionicons name="business-outline" size={12} color="#94A3B8" />
              <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wide" numberOfLines={1}>
                {item.empresa_nombre}
              </Text>
            </View>
          )}

          <View className="flex-row items-start justify-between gap-2">
            <Text className="text-base font-semibold text-foreground flex-1" numberOfLines={1}>
              {item.titulo}
            </Text>
            {esPasado ? (
              <Badge label="Pasado" variant="default" size="sm" />
            ) : plazasLibres > 0 ? (
              <Badge
                label={`${plazasLibres} libre${plazasLibres > 1 ? 's' : ''}`}
                variant={plazasLibres <= 2 ? 'warning' : 'info'}
                size="sm"
              />
            ) : null}
          </View>

          {hayVariosCargos ? (
            <View className="flex-row items-center gap-1 -mt-1">
              <Ionicons name="briefcase-outline" size={12} color="#64748B" />
              <Text className="text-xs text-muted-foreground">
                {puestosDisponibles.length} cargos disponibles
              </Text>
            </View>
          ) : (firstAvailablePuesto ?? item.puestos?.[0])?.cargo_nombre && (
            <View className="flex-row items-center gap-1 -mt-1">
              <Ionicons name="briefcase-outline" size={12} color="#64748B" />
              <Text className="text-xs text-muted-foreground">
                {(firstAvailablePuesto ?? item.puestos?.[0])?.cargo_nombre}
              </Text>
            </View>
          )}

          {hayTraslape && (
            <View className="flex-row items-center gap-1.5 bg-warning/10 rounded-xl px-2.5 py-1.5">
              <Ionicons name="warning-outline" size={13} color="#D97706" />
              <Text className="text-xs font-medium text-warning flex-1">
                Ya tienes un turno confirmado en este horario
              </Text>
            </View>
          )}

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
            <Text className={`text-sm font-semibold ${esPasado ? 'text-muted-foreground' : 'text-success'}`}>
              {hayVariasTarifas ? 'Desde ' : ''}${tarifaMin.toLocaleString('es-CO')} / turno
            </Text>
            {esPasado ? (
              <Text className="text-xs text-muted-foreground">Evento finalizado</Text>
            ) : yaAplicado ? (
              <Badge label="Ya postulado" variant="info" size="sm" />
            ) : !firstAvailablePuesto ? (
              <Badge label="Sin plazas" variant="default" size="sm" />
            ) : hayVariosCargos ? (
              <Button
                label="Elegir cargo"
                variant="primary"
                size="sm"
                onPress={() => router.push(`/oferta/${item.id}` as any)}
              />
            ) : (
              <Button
                label={aplicarMutation.isPending ? 'Aplicando…' : 'Aplicar'}
                variant="primary"
                size="sm"
                loading={aplicarMutation.isPending}
                onPress={() => aplicarMutation.mutate({ ofertaId: item.id, puestoId: firstAvailablePuesto.id })}
              />
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  }, [aplicadosIds, aplicarMutation, turnosConfirmados, today]);

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
      <Text className="text-base font-semibold text-foreground">Sin ofertas este día</Text>
      <Text className="text-sm text-muted-foreground text-center px-8">
        No hay turnos disponibles el{' '}
        {formatShortDate(selectedDate)}. Prueba con otra fecha.
      </Text>
    </View>
  );

  // ── Main render ───────────────────────────────────────────────────────

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>

      {/* ── Header ─────────────────────────────────────────────────── */}
      <View className="bg-card px-6 pt-3 pb-2 border-b border-border">
        <View className="flex-row items-center justify-between">
          <Text className="text-xl font-bold text-foreground">
            {isJefeNomina ? 'Turnos Eventuales' : isGestor ? 'Gestión de Turnos' : isNomina ? 'Turnos Extra' : 'Mis Turnos'}
          </Text>
          {(isGestor || isWorker) && (
            <TouchableOpacity
              onPress={() => setViewMode(v => v === 'lista' ? 'mes' : 'lista')}
              accessibilityLabel={viewMode === 'lista' ? 'Ver mes' : 'Ver lista'}
              className="p-2 -mr-2 active:opacity-60"
            >
              <Ionicons name={viewMode === 'lista' ? 'calendar-outline' : 'list-outline'} size={22} color={theme.primary} />
            </TouchableOpacity>
          )}
        </View>

        {/* Saldo a pagar del mes + postulantes pendientes — igual patrón que Nómina */}
        {isGestor && !isJefeNomina && (
          <View className="flex-row gap-2 mt-2.5">
            <TouchableOpacity
              onPress={() => router.push('/liquidacion-turnos')}
              activeOpacity={0.8}
              className="flex-1 flex-row items-center justify-between rounded-2xl px-4 py-2.5"
              style={{ backgroundColor: theme.primary + '15' }}
            >
              <View>
                <Text className="text-[11px] font-medium" style={{ color: theme.primary }}>
                  Total a pagar este mes
                </Text>
                <Text className="text-base font-extrabold" style={{ color: theme.primary }}>
                  ${totalAPagarMes.toLocaleString('es-CO')}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={theme.primary} />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => router.push('/postulaciones')}
              activeOpacity={0.8}
              accessibilityLabel="Ver postulaciones"
              className="items-center justify-center rounded-2xl"
              style={{ backgroundColor: pendientesCount > 0 ? '#FEF3C7' : '#F1F5F9', minWidth: 68, paddingHorizontal: 12 }}
            >
              <Ionicons name="people" size={18} color={pendientesCount > 0 ? '#D97706' : '#64748B'} />
              <Text
                className="text-[10px] font-bold mt-0.5"
                style={{ color: pendientesCount > 0 ? '#D97706' : '#64748B' }}
              >
                {pendientesCount > 0 ? `${pendientesCount} pend.` : 'Al día'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* ── Week strip ─────────────────────────────────────────────── */}
      {viewMode === 'lista' && (
        <WeekStrip
          days={allDays}
          selectedDate={selectedDate}
          datesWithShifts={datesWithShifts}
          onSelectDate={setSelectedDate}
          primaryColor={theme.primary}
        />
      )}

      {/* ── Gestor view ────────────────────────────────────────────── */}
      {isGestor ? (
        <View className="flex-1">
          {viewMode === 'mes' ? (
            <View className="flex-1 px-5 pt-3">
              <View className="flex-row items-center gap-3 mb-3">
                <TouchableOpacity
                  onPress={() => setMesCursor(c => shiftMonth(c, -1))}
                  className="w-8 h-8 items-center justify-center rounded-lg border border-border"
                >
                  <Ionicons name="chevron-back" size={16} color={theme.primary} />
                </TouchableOpacity>
                <Text className="text-sm font-semibold text-foreground flex-1 text-center">
                  {MESES_LARGOS[mesCursor.month - 1]} {mesCursor.year}
                </Text>
                <TouchableOpacity
                  onPress={() => setMesCursor(c => shiftMonth(c, 1))}
                  className="w-8 h-8 items-center justify-center rounded-lg border border-border"
                >
                  <Ionicons name="chevron-forward" size={16} color={theme.primary} />
                </TouchableOpacity>
              </View>

              {loadingOfertasMes ? (
                <ActivityIndicator size="large" color={theme.primary} />
              ) : (
                <MonthCalendar
                  weeks={mesWeeks}
                  onDayPress={(day: CalendarDay) => { setSelectedDate(day.date); setViewMode('lista'); }}
                  renderDay={(day: CalendarDay) => {
                    const delDia = ofertasPorDiaMes.get(day.date) ?? [];
                    if (delDia.length === 0) return null;
                    return (
                      <View className="flex-row flex-wrap gap-0.5">
                        {delDia.slice(0, 5).map(o => (
                          <View
                            key={o.id}
                            className="w-1.5 h-1.5 rounded-full"
                            style={{ backgroundColor: colorOferta(o, pendientesPorOferta, today, theme.primary) }}
                          />
                        ))}
                      </View>
                    );
                  }}
                />
              )}

              <View className="flex-row items-center gap-x-3 gap-y-1.5 justify-center mt-3 flex-wrap">
                <LeyendaPunto color={CAL_COLOR.borrador} label="Borrador" />
                <LeyendaPunto color={theme.primary} label="Publicada" />
                <LeyendaPunto color={CAL_COLOR.urgente} label="Necesita atención" />
                <LeyendaPunto color={CAL_COLOR.completada} label="Completada" />
                <LeyendaPunto color={CAL_COLOR.cancelada} label="Cancelada" />
              </View>
            </View>
          ) : (
            <GestorTurnosView
              selectedDate={selectedDate}
              filtroParaQuien={isJefeNomina ? 'nomina' : undefined}
            />
          )}

          {/* FAB — crear turno (única acción flotante; liquidación y postulaciones viven en el header) */}
          <TouchableOpacity
            onPress={() => router.push('/turno/nuevo')}
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
            accessibilityLabel="Crear turno"
          >
            <Ionicons name="add" size={28} color="#fff" />
          </TouchableOpacity>
        </View>
      ) : (
        <>
        {viewMode === 'mes' ? (
          <View className="flex-1 px-5 pt-3">
            <View className="flex-row items-center gap-3 mb-3">
              <TouchableOpacity
                onPress={() => setMesCursor(c => shiftMonth(c, -1))}
                className="w-8 h-8 items-center justify-center rounded-lg border border-border"
              >
                <Ionicons name="chevron-back" size={16} color={theme.primary} />
              </TouchableOpacity>
              <Text className="text-sm font-semibold text-foreground flex-1 text-center">
                {MESES_LARGOS[mesCursor.month - 1]} {mesCursor.year}
              </Text>
              <TouchableOpacity
                onPress={() => setMesCursor(c => shiftMonth(c, 1))}
                className="w-8 h-8 items-center justify-center rounded-lg border border-border"
              >
                <Ionicons name="chevron-forward" size={16} color={theme.primary} />
              </TouchableOpacity>
            </View>

            {loadingOfertasMes || loadingMios ? (
              <ActivityIndicator size="large" color={theme.primary} />
            ) : (
              <MonthCalendar
                weeks={mesWeeks}
                onDayPress={(day: CalendarDay) => { setSelectedDate(day.date); setViewMode('lista'); }}
                renderDay={(day: CalendarDay) => {
                  const mios = misTurnosPorDiaMes.get(day.date) ?? [];
                  // Naranja sólido solo si ya está aceptado (confirmado/en curso/completado) —
                  // una postulación pendiente todavía no es un turno asegurado.
                  const aceptados  = mios.filter(a => a.estado === 'confirmado' || a.estado === 'en_progreso' || a.estado === 'completado');
                  const pendientes = mios.filter(a => a.estado === 'pendiente');
                  const disponibles = (ofertasPorDiaMes.get(day.date) ?? []).filter(o => !aplicadosIds.has(o.id));
                  if (aceptados.length === 0 && pendientes.length === 0 && disponibles.length === 0) return null;
                  return (
                    <View className="flex-row flex-wrap gap-0.5">
                      {aceptados.slice(0, 3).map(a => (
                        <View key={`a${a.id}`} className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: theme.primary }} />
                      ))}
                      {pendientes.slice(0, 2).map(a => (
                        <View key={`p${a.id}`} className="w-1.5 h-1.5 rounded-full border" style={{ borderColor: theme.primary }} />
                      ))}
                      {disponibles.slice(0, 3).map(o => (
                        <View key={`d${o.id}`} className="w-1.5 h-1.5 rounded-full border" style={{ borderColor: '#3B82F6' }} />
                      ))}
                    </View>
                  );
                }}
              />
            )}

            <View className="flex-row items-center gap-4 justify-center mt-4 flex-wrap">
              <View className="flex-row items-center gap-1.5">
                <View className="w-2 h-2 rounded-full" style={{ backgroundColor: theme.primary }} />
                <Text className="text-xs text-muted-foreground">Aceptado</Text>
              </View>
              <View className="flex-row items-center gap-1.5">
                <View className="w-2 h-2 rounded-full border" style={{ borderColor: theme.primary }} />
                <Text className="text-xs text-muted-foreground">Postulación pendiente</Text>
              </View>
              <View className="flex-row items-center gap-1.5">
                <View className="w-2 h-2 rounded-full border" style={{ borderColor: '#3B82F6' }} />
                <Text className="text-xs text-muted-foreground">Disponibles</Text>
              </View>
            </View>
          </View>
        ) : (
        <>
          {/* ── Banner turnos eventuales (trabajador_nomina) ─────── */}
          {isNomina && (
            <TouchableOpacity
              onPress={() => periodoEventual && router.push('/liquidacion-eventual')}
              activeOpacity={periodoEventual ? 0.8 : 1}
              disabled={!periodoEventual}
              className="mx-5 mt-3 bg-violet-50 border border-violet-200 rounded-2xl px-4 py-3 flex-row items-center gap-3"
              style={{ opacity: periodoEventual ? 1 : 0.6 }}
            >
              <Ionicons name="briefcase-outline" size={20} color="#7C3AED" />
              <View className="flex-1">
                <Text className="text-sm font-semibold text-violet-700">Turnos eventuales · Pago trimestral</Text>
                <Text className="text-xs text-violet-500 mt-0.5">
                  {periodoEventual
                    ? (periodoEventual.estado === 'abierto' ? `Período abierto hasta ${periodoEventual.fecha_fin}` : 'Período liquidado')
                    : 'Aún no hay período eventual abierto'}
                </Text>
              </View>
              {periodoEventual && <Ionicons name="chevron-forward-outline" size={16} color="#7C3AED" />}
            </TouchableOpacity>
          )}

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
                <Text className="text-base font-semibold text-foreground">
                  {apiErrorMessage(errMios, 'Error al cargar turnos')}
                </Text>
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
            ) : errorOfertas ? (
              <View className="flex-1 items-center justify-center gap-3 px-6">
                <Ionicons name="warning-outline" size={48} color="#94A3B8" />
                <Text className="text-base font-semibold text-foreground">
                  {apiErrorMessage(errOfertas, 'Error al cargar ofertas')}
                </Text>
                <Button label="Reintentar" onPress={() => refetchOfertas()} variant="secondary" />
              </View>
            ) : (
              <FlatList
                data={ofertasFiltradas}
                keyExtractor={(item) => String(item.id)}
                renderItem={renderOfertaCard}
                contentContainerClassName="px-5 py-4 gap-3"
                ListHeaderComponent={
                  <>
                    {!isNomina && (
                      <TouchableOpacity
                        onPress={() => router.push('/mis-empresas')}
                        className="flex-row items-center gap-2 bg-info/10 rounded-xl px-3 py-2 mb-3"
                      >
                        <Ionicons name="information-circle-outline" size={15} color="#3B82F6" />
                        <Text className="text-xs text-info flex-1">
                          Ves las ofertas antes o después según tu calificación en cada empresa.
                        </Text>
                        <Text className="text-xs font-semibold text-info">Ver</Text>
                      </TouchableOpacity>
                    )}
                    {ofertas.length > 0 && (
                      <View className="flex-row items-center bg-card border border-border rounded-xl px-3 h-10 mb-3">
                        <Ionicons name="search-outline" size={15} color="#64748B" style={{ marginRight: 8 }} />
                        <TextInput
                          className="flex-1 text-sm text-foreground"
                          placeholder="Buscar por empresa, cargo o lugar…"
                          placeholderTextColor="#94A3B8"
                          value={searchOfertas}
                          onChangeText={setSearchOfertas}
                          autoCorrect={false}
                        />
                        {searchOfertas.length > 0 && (
                          <TouchableOpacity onPress={() => setSearchOfertas('')} hitSlop={8}>
                            <Ionicons name="close-circle" size={16} color="#94A3B8" />
                          </TouchableOpacity>
                        )}
                      </View>
                    )}
                  </>
                }
                ListEmptyComponent={
                  searchOfertas.trim() ? (
                    <View className="items-center justify-center py-16 gap-2">
                      <Ionicons name="search-outline" size={40} color="#94A3B8" />
                      <Text className="text-sm text-muted-foreground text-center">
                        Sin resultados para "{searchOfertas}"
                      </Text>
                    </View>
                  ) : <EmptyOfertas />
                }
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
        </>
      )}
    </SafeAreaView>
  );
}

// ── Local helpers ─────────────────────────────────────────────────────────

const SHORT_DAYS   = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const SHORT_MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
function formatShortDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return `${SHORT_DAYS[d.getDay()]} ${d.getDate()} ${SHORT_MONTHS[d.getMonth()]}`;
}

function fmtRangeSimple(start: string, end: string | null): string {
  const s = start.slice(0, 5).replace(/^0/, '');
  if (!end) return s;
  return `${s} – ${end.slice(0, 5).replace(/^0/, '')}`;
}

/** Detecta si una oferta se solapa en horario con algún turno confirmado del trabajador. */
function turnosSolapan(oferta: Oferta, confirmados: Asignacion[]): boolean {
  const ofFin = oferta.hora_fin_estimada ?? '23:59:59';
  return confirmados.some((a) => {
    if (a.oferta_fecha !== oferta.fecha) return false;
    const aFin = a.hora_fin_estimada ?? '23:59:59';
    return a.hora_inicio < ofFin && aFin > oferta.hora_inicio;
  });
}

const CAL_COLOR = {
  borrador:   '#94A3B8', // gris — no publicada, no requiere acción
  urgente:    '#F59E0B', // ámbar — puestos sin cubrir cerca de la fecha, o postulantes sin revisar
  completada: '#059669', // verde
  cancelada:  '#EF4444', // rojo
  // Naranja (activa, sin urgencia) usa `primary` del theme — es el acento del módulo Turnos.
};

/**
 * Color del punto de calendario del gestor para una oferta.
 * "Completada con incidencia" (no_presentado/sospechoso) queda fuera a propósito:
 * requeriría traer las asignaciones de cada oferta del mes (N+1), no solo el listado —
 * upgrade path: que el backend agregue un flag `tiene_incidencias` a GET /ofertas.
 */
function colorOferta(o: Oferta, pendientesPorOferta: Map<number, number>, today: string, primary: string): string {
  if (o.estado === 'cancelada')  return CAL_COLOR.cancelada;
  if (o.estado === 'completada') return CAL_COLOR.completada;
  if (o.estado === 'borrador')   return CAL_COLOR.borrador;

  const totalPlazas = o.puestos?.reduce((s, p) => s + p.plazas, 0) ?? 0;
  const cubiertas   = o.puestos?.reduce((s, p) => s + p.plazas_cubiertas, 0) ?? 0;
  const incompleta  = cubiertas < totalPlazas;
  const pendientes  = pendientesPorOferta.get(o.id) ?? 0;
  const diasHasta   = (new Date(`${o.fecha}T00:00:00`).getTime() - new Date(`${today}T00:00:00`).getTime()) / 86_400_000;
  const urgente = pendientes > 0 || (incompleta && diasHasta <= 3);

  return urgente ? CAL_COLOR.urgente : primary;
}

function LeyendaPunto({ color, label }: { color: string; label: string }) {
  return (
    <View className="flex-row items-center gap-1.5">
      <View className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
      <Text className="text-xs text-muted-foreground">{label}</Text>
    </View>
  );
}
