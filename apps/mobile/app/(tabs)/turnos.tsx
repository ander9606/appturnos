import { PantallaPestana, EncabezadoPestana } from '@/components/ui/EncabezadoPestana';
import { ErrorState } from '@/components/ui/ErrorState';
import { SkeletonList } from '@/components/ui/Skeleton';
import { COLORS } from '@/lib/designTokens';
import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';

import { useRouter } from 'expo-router';
import { useAuthStore } from '@/features/auth/useAuthStore';
import { useTheme }     from '@/lib/theme';
import { useMisTurnos, useOfertas, useAplicar, usePostulacionesPendientes, useLiquidacionTurnos } from '@/features/turnos/useTurnos';
import { usePeriodosEventual } from '@/features/turnos/useTurnosEventual';
import { useNominaPerfil, usePeriodos } from '@/features/nomina/useNomina';
import { TurnosExtraOptIn, esErrorTurnosExtraApagadas } from '@/features/nomina/TurnosExtraOptIn';
import { WeekStrip }  from '@/features/turnos/WeekStrip';
import { ShiftCard }  from '@/features/turnos/ShiftCard';
import { GestorTurnosView } from '@/features/turnos/GestorTurnosView';
import { getDateRange, fmtRange, getEstadoConfig } from '@/features/turnos/turnosUtils';
import { ResumenDiaMes, type ItemDia } from '@/features/turnos/ResumenDiaMes';
import { bogotaToday } from '@/lib/formatters';
import { Ionicons } from '@expo/vector-icons';
import { getMonthGrid, mesDeHoy, type CalendarDay } from '@/lib/calendar';
import type { Asignacion, Oferta } from '@api-client';
import { OfertaCard } from '@/features/turnos/pestana/OfertaCard';
import { colorOferta } from '@/features/turnos/pestana/turnosPestana';
import { CalendarioMesGestor, CalendarioMesTrabajador } from '@/features/turnos/pestana/CalendarioMes';
import {
  ResumenGestor, FabCrearTurno, BannerEventual, SelectorTabs, EncabezadoOfertas, EmptyMisTurnos, EmptyOfertas,
  type ActiveTab,
} from '@/features/turnos/pestana/ElementosPestana';

// ── Screen ────────────────────────────────────────────────────────────────

export default function TurnosScreen() {
  const rol           = useAuthStore((s) => s.usuario?.rol);
  const puedeGestionar = rol === 'jefe_turnos' || rol === 'admin_empresa';
  const isGestor      = puedeGestionar || rol === 'jefe_nomina';
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
  const { data: ofertasMesResp, isLoading: loadingOfertasMes, isError: errorOfertasMes, error: errOfertasMes, refetch: refetchOfertasMes } = useOfertas(
    {
      fecha_desde: mesWeeks[0][0].date,
      fecha_hasta: mesWeeks[mesWeeks.length - 1][6].date,
      limit: 200, // tope del backend (ofertas.routes.js) — pedir más hace que la validación rechace TODA la respuesta
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
  const { data: pendientesResp } = usePostulacionesPendientes({ enabled: puedeGestionar });
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

  // Saldo a pagar del período abierto — solo para quien gestiona pagos de turnos.
  // Antes usaba un mes calendario fijo (día 1 → hoy), lo que mostraba "mensual"
  // aunque la empresa facture quincenal — el período real sale de periodos_nomina.
  const { data: periodoAbiertoResp } = usePeriodos('abierto', puedeGestionar);
  const periodoAbierto = periodoAbiertoResp?.data?.[0];
  const { data: liquidacionPeriodo } = useLiquidacionTurnos(
    { fecha_inicio: periodoAbierto?.fecha_inicio ?? today, fecha_fin: today },
    { enabled: puedeGestionar && periodoAbierto !== undefined },
  );
  const totalAPagarPeriodo = (liquidacionPeriodo ?? []).reduce((s, w) => s + w.pago_total, 0);

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
  /** Ofertas abiertas a las que todavía no se ha postulado (círculo de la pestaña "Disponibles"). */
  const disponiblesCount = useMemo(() => (ofertasResp?.data ?? []).filter((o) => !aplicadosIds.has(o.id)).length, [ofertasResp, aplicadosIds]);

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

  const renderOfertaCard = useCallback(({ item }: { item: Oferta }) => (
    <OfertaCard
      item={item}
      today={today}
      yaAplicado={aplicadosIds.has(item.id)}
      turnosConfirmados={turnosConfirmados}
      aplicando={aplicarMutation.isPending}
      onAplicar={(ofertaId, puestoId) => aplicarMutation.mutateAsync({ ofertaId, puestoId }).catch(() => undefined)}
    />
  ), [aplicadosIds, aplicarMutation, turnosConfirmados, today]);

  const refreshControl = (
    <RefreshControl
      refreshing={isRefreshing}
      onRefresh={onRefresh}
      tintColor={theme.primary}
      colors={[theme.primary]}
    />
  );

  const marcarDia = (day: CalendarDay) => setSelectedDate(day.date);
  const irAHoy = () => { setMesCursor(mesDeHoy()); setSelectedDate(today); };
  const verLista = () => setViewMode('lista');

  // Vista previa del día marcado en el calendario del mes (funciones simples: leen datos ya calculados arriba).
  const itemsGestorDia = (fecha: string): ItemDia[] => (ofertasPorDiaMes.get(fecha) ?? []).map(o => {
    const total = o.puestos?.reduce((s, p) => s + p.plazas, 0) ?? 0;
    const cubiertas = o.puestos?.reduce((s, p) => s + p.plazas_cubiertas, 0) ?? 0;
    return {
      key: `o${o.id}`,
      titulo: o.titulo,
      detalle: `${fmtRange(o.hora_inicio, o.hora_fin_estimada)} · ${cubiertas}/${total} plazas cubiertas`,
      color: colorOferta(o, pendientesPorOferta, today, theme.primary),
      onPress: () => router.push(`/oferta/${o.id}`),
    };
  });
  const itemsTrabajadorDia = (fecha: string): ItemDia[] => [
    ...(misTurnosPorDiaMes.get(fecha) ?? []).map(a => ({
      key: `a${a.id}`,
      titulo: a.oferta_titulo,
      detalle: getEstadoConfig(a.estado).label,
      color: theme.primary,
      onPress: () => router.push(`/turno/${a.id}`),
    })),
    ...(ofertasPorDiaMes.get(fecha) ?? []).filter(o => !aplicadosIds.has(o.id)).map(o => ({
      key: `d${o.id}`,
      titulo: o.titulo,
      detalle: `Disponible · ${fmtRange(o.hora_inicio, o.hora_fin_estimada)}`,
      color: COLORS.info,
      onPress: () => router.push(`/oferta/${o.id}`),
    })),
  ];

  // ── Main render ───────────────────────────────────────────────────────

  return (
    <PantallaPestana>

      {/* ── Header ─────────────────────────────────────────────────── */}
      <EncabezadoPestana
        titulo={isGestor ? 'Gestión de Turnos' : isNomina ? 'Turnos Extra' : 'Mis Turnos'}
        derecha={(isGestor || isWorker) ? (
          <TouchableOpacity
            onPress={() => setViewMode(v => v === 'lista' ? 'mes' : 'lista')}
            accessibilityLabel={viewMode === 'lista' ? 'Ver mes' : 'Ver lista'}
            className="p-2 -mr-2 active:opacity-60"
          >
            <Ionicons name={viewMode === 'lista' ? 'calendar-outline' : 'list-outline'} size={22} color={COLORS.white} />
          </TouchableOpacity>
        ) : undefined}
      >
        {/* Saldo a pagar del mes + postulantes pendientes — igual patrón que Nómina */}
        {puedeGestionar && <ResumenGestor totalAPagar={totalAPagarPeriodo} pendientesCount={pendientesCount} />}
      </EncabezadoPestana>

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
            <CalendarioMesGestor
              cursor={mesCursor}
              onCursor={setMesCursor}
              weeks={mesWeeks}
              loading={loadingOfertasMes}
              isError={errorOfertasMes}
              error={errOfertasMes}
              onRetry={refetchOfertasMes}
              ofertasPorDia={ofertasPorDiaMes}
              pendientesPorOferta={pendientesPorOferta}
              today={today}
              onDayPress={marcarDia}
              selectedDate={selectedDate}
              onHoy={irAHoy}
              resumen={<ResumenDiaMes fecha={selectedDate} items={itemsGestorDia(selectedDate)} onVerLista={verLista} />}
            />
          ) : (
            <GestorTurnosView
              selectedDate={selectedDate}
              puedeGestionar={puedeGestionar}
            />
          )}

          {puedeGestionar && <FabCrearTurno />}
        </View>
      ) : (
        <>
        {viewMode === 'mes' ? (
          <CalendarioMesTrabajador
            cursor={mesCursor}
            onCursor={setMesCursor}
            weeks={mesWeeks}
            loading={loadingOfertasMes || loadingMios}
            isNomina={isNomina}
            errOfertas={{ isError: errorOfertasMes, error: errOfertasMes }}
            errMios={{ isError: errorMios, error: errMios }}
            onRetry={() => Promise.all([refetchOfertasMes(), refetchMios()])}
            misTurnosPorDia={misTurnosPorDiaMes}
            ofertasPorDia={ofertasPorDiaMes}
            aplicadosIds={aplicadosIds}
            onDayPress={marcarDia}
            selectedDate={selectedDate}
            onHoy={irAHoy}
            resumen={<ResumenDiaMes fecha={selectedDate} items={itemsTrabajadorDia(selectedDate)} onVerLista={verLista} />}
          />
        ) : (
        <>
          {/* ── Banner turnos eventuales (trabajador_nomina) ─────── */}
          {isNomina && <BannerEventual periodo={periodoEventual} />}

          {/* ── Tab selector ─────────────────────────────────────── */}
          {isWorker && <SelectorTabs activeTab={activeTab} onChange={setActiveTab} disponibles={disponiblesCount} />}

          {/* ── Worker list ──────────────────────────────────────── */}
          {(!isWorker || activeTab === 'mis_turnos') ? (
            loadingMios ? (
              <SkeletonList style={{ paddingHorizontal: 16, paddingTop: 12 }} />
            ) : errorMios ? (
              <ErrorState error={errMios} onRetry={refetchMios} fallback="Error al cargar turnos" />
            ) : (
              <FlatList
                data={turnosDelDia}
                keyExtractor={(item) => String(item.id)}
                renderItem={renderShiftCard}
                contentContainerClassName="px-5 py-4 gap-3"
                ListEmptyComponent={<EmptyMisTurnos fecha={selectedDate} />}
                refreshControl={refreshControl}
                showsVerticalScrollIndicator={false}
              />
            )
          ) : (
            loadingOfertas ? (
              <SkeletonList style={{ paddingHorizontal: 16, paddingTop: 12 }} />
            ) : isNomina && esErrorTurnosExtraApagadas(errOfertas) ? (
              <TurnosExtraOptIn />
            ) : errorOfertas ? (
              <ErrorState error={errOfertas} onRetry={refetchOfertas} fallback="Error al cargar ofertas" />
            ) : (
              <FlatList
                data={ofertasFiltradas}
                keyExtractor={(item) => String(item.id)}
                renderItem={renderOfertaCard}
                contentContainerClassName="px-5 py-4 gap-3"
                ListHeaderComponent={
                  <EncabezadoOfertas
                    isNomina={isNomina}
                    hayOfertas={ofertas.length > 0}
                    search={searchOfertas}
                    onSearch={setSearchOfertas}
                  />
                }
                ListEmptyComponent={<EmptyOfertas fecha={selectedDate} search={searchOfertas} />}
                refreshControl={refreshControl}
                showsVerticalScrollIndicator={false}
              />
            )
          )}
        </>
        )}
        </>
      )}
    </PantallaPestana>
  );
}
