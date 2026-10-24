/**
 * NominaTrabajadorView — pantalla principal del trabajador_nomina.
 *
 * Renderiza el marcaje de jornada (entrada/salida) + resumen del período.
 * Toda la lógica de negocio vive en useNominaTrabajador + nominaTrabajadorUtils.
 */

import { SkeletonList } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { Text } from '@/components/ui/Text';
import { ErrorState } from '@/components/ui/ErrorState';
import { COLORS, alpha } from '@/lib/designTokens';
import React, { useState, useMemo, useEffect } from 'react';
import { View, FlatList, RefreshControl, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '@/lib/theme';
import { formatShortDate } from '@/lib/formatters';
import { RegistroCard } from '../RegistroCard';
import { PeriodoHeaderCard } from './components/PeriodoHeaderCard';
import { ResumenCards } from './components/ResumenCards';
import { DescuentosPendientesModal } from './components/DescuentosPendientesModal';
import { TurnosEventualCard } from './components/TurnosEventualCard';
import { IngresoHoyTab } from './components/IngresoHoyTab';
import { useNominaTrabajador } from './useNominaTrabajador';
import { analizarDia } from './nominaTrabajadorUtils';
import { useMisCompensatorios } from '../compensatorios/useCompensatorios';
import { useRegistrosHistorial } from '../useNomina';
import { NavegadorMes } from '@/components/ui/NavegadorMes';
import { MonthCalendar } from '@/components/ui/MonthCalendar';
import { getMonthGrid, shiftMonth, mesDeHoy, type CalendarDay } from '@/lib/calendar';
import { bogotaToday } from '@/lib/formatters';
import type { TipoDia } from '@api-client';

type ActiveTab = 'hoy' | 'nomina';

/** Días que cuentan como "libre" vs una ausencia distinta — no distinguimos más que esto
 *  porque lo único que se pidió fue "saber cuándo estará de descanso". */
const DIA_LIBRE: Partial<Record<TipoDia, boolean>> = { descanso: true, compensatorio: true, vacacion: true };
const DIA_AUSENCIA: Partial<Record<TipoDia, boolean>> = { incapacidad: true, licencia: true };

export function NominaTrabajadorView() {
  const theme = useTheme();
  const router = useRouter();
  const { data: compensatorios = [] } = useMisCompensatorios();
  const [activeTab, setActiveTab] = useState<ActiveTab>('hoy');

  // Vista mensual — "¿cuándo estaré de descanso?" — alterna con la lista de registros.
  const [viewMode, setViewMode] = useState<'lista' | 'mes'>('lista');
  const [mesCursor, setMesCursor] = useState(() => {
    const [y, m] = bogotaToday().split('-').map(Number);
    return { year: y, month: m };
  });
  const mesWeeks = useMemo(() => getMonthGrid(mesCursor.year, mesCursor.month), [mesCursor]);
  const mesAnterior  = () => setMesCursor(c => shiftMonth(c, -1));
  const mesSiguiente = () => setMesCursor(c => shiftMonth(c, 1));
  const hoyCursor    = mesDeHoy();
  const esMesActual  = mesCursor.year === hoyCursor.year && mesCursor.month === hoyCursor.month;
  const { data: historialResp } = useRegistrosHistorial({
    enabled: activeTab === 'nomina' && viewMode === 'mes',
    fechaDesde: mesWeeks[0][0].date,
    fechaHasta: mesWeeks[mesWeeks.length - 1][6].date,
  });
  const tipoDiaPorFecha = useMemo(() => {
    const map = new Map<string, TipoDia>();
    for (const r of historialResp?.data ?? []) map.set(r.fecha, r.tipo_dia);
    return map;
  }, [historialResp]);
  const compensatoriosAsignadosPorFecha = useMemo(() => {
    const map = new Map<string, true>();
    for (const c of compensatorios) {
      if (c.estado === 'asignado' && c.fecha_asignada) map.set(c.fecha_asignada, true);
    }
    return map;
  }, [compensatorios]);

  const {
    valorHora,
    salarioBase,
    tipoMarcacion,
    cargo,
    puntoMarcaje,
    puntosZonales,
    periodos,
    periodoActivo,
    setPeriodoSeleccionado,
    registros,
    resumen,
    resumenSemana,
    horasSemanaPeriodoAnterior,
    registroHoy,
    estadoHoy,
    todayISO,
    miLiquidacion,
    tipoContrato,
    misDescuentos,
    aceptaExtras,
    periodoEventual,
    miLineaEventual,
    loading,
    loadingRegistros,
    isRefetching,
    onRefresh,
    isError,
    error,
  } = useNominaTrabajador();

  const analisisHoy = useMemo(
    () => (registroHoy ? analizarDia(registroHoy, valorHora) : null),
    [registroHoy, valorHora],
  );

  const todayLabel = formatShortDate(todayISO);
  const pendientesLista = useMemo(() => misDescuentos.filter((d) => d.estado === 'pendiente'), [misDescuentos]);
  const descuentosPendientes = pendientesLista.length;

  // Emergente de descuentos: sale sola la primera vez que hay pendientes; luego se reabre a mano.
  const [modalDescuentos, setModalDescuentos] = useState(false);
  const [modalYaAbierto, setModalYaAbierto] = useState(false);
  useEffect(() => {
    if (descuentosPendientes > 0 && !modalYaAbierto) {
      setModalDescuentos(true);
      setModalYaAbierto(true);
    }
  }, [descuentosPendientes, modalYaAbierto]);

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-background" edges={['top']}>
        <SkeletonList style={{ paddingHorizontal: 16, paddingTop: 12 }} />
      </SafeAreaView>
    );
  }

  if (isError) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center gap-3 px-6" edges={['top']}>
        <ErrorState error={error} onRetry={onRefresh} fallback="Error al cargar tu nómina" />
      </SafeAreaView>
    );
  }

  if (periodos.length === 0) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center gap-3 px-8" edges={['top']}>
        <Ionicons name="clipboard-outline" size={48} color={COLORS.placeholder} />
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
      {/* ── Tab switcher ───────────────────────────────────── */}
      <View className="bg-card flex-row border-b border-border px-6">
        {(['hoy', 'nomina'] as ActiveTab[]).map((tab) => {
          const label = tab === 'hoy' ? 'Hoy' : 'Mi Nómina';
          const isActive = activeTab === tab;
          return (
            <TouchableOpacity
              key={tab}
              onPress={() => setActiveTab(tab)}
              className={`py-3 mr-6 border-b-2 ${isActive ? 'border-primary-500' : 'border-transparent'}`}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
            >
              <View className="flex-row items-center gap-1.5">
                <Text className={`text-sm font-semibold ${isActive ? 'text-primary-500' : 'text-muted-foreground'}`}>
                  {label}
                </Text>
                {tab === 'nomina' && descuentosPendientes > 0 && (
                  <View className="min-w-[18px] h-[18px] px-1 rounded-full bg-warning items-center justify-center">
                    <Text className="text-[10px] font-bold text-white">{descuentosPendientes}</Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Aviso de descuentos por aceptar — abre la ventana emergente para responderlos */}
      {activeTab === 'hoy' && descuentosPendientes > 0 && (
        <TouchableOpacity
          onPress={() => setModalDescuentos(true)}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Responder los descuentos pendientes"
          className="mx-5 mt-3 flex-row items-center gap-3 rounded-2xl bg-warning/10 px-4 py-3"
        >
          <Ionicons name="alert-circle-outline" size={20} color={theme.primary} />
          <View className="flex-1">
            <Text className="text-sm font-semibold text-foreground">
              {descuentosPendientes} descuento{descuentosPendientes > 1 ? 's' : ''} por aceptar
            </Text>
            <Text className="text-xs text-muted-foreground">
              Toca para aceptarlos o rechazarlos
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={COLORS.mutedForeground} />
        </TouchableOpacity>
      )}

      {/* ── Tab: Hoy ───────────────────────────────────────── */}
      {activeTab === 'hoy' ? (
        <IngresoHoyTab
          cargo={cargo}
          puntoMarcaje={puntoMarcaje}
          puntosZonales={puntosZonales}
          tipoMarcacion={tipoMarcacion}
          estadoHoy={estadoHoy}
          periodoAbierto={periodoActivo?.estado === 'abierto'}
          resumenSemana={resumenSemana}
          horasPeriodoAnterior={horasSemanaPeriodoAnterior}
          registroHoy={registroHoy}
          compensatorios={compensatorios}
          isRefetching={isRefetching}
          onRefresh={onRefresh}
          primaryColor={theme.primary}
          onVerDetalles={() => setActiveTab('nomina')}
        />
      ) : (
        /* ── Tab: Mi Nómina ──────────────────────────────── */
        <FlatList
          data={viewMode === 'mes' ? [] : registros}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => (
            <RegistroCard registro={item} valorHora={valorHora} periodoInicio={periodoActivo?.fecha_inicio} />
          )}
          contentContainerClassName="gap-2 pb-8"
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={onRefresh}
              tintColor={theme.primary}
              colors={[theme.primary]}
            />
          }
          ListHeaderComponent={
            <View className="gap-4 pb-2">
              <PeriodoHeaderCard
                periodo={periodoActivo}
                registroHoy={registroHoy}
                estadoHoy={estadoHoy}
                resumen={resumen}
                resumenSemana={resumenSemana}
                horasPeriodoAnterior={horasSemanaPeriodoAnterior}
                salarioBase={salarioBase}
                valorHora={valorHora}
                color={theme.primary}
                todayLabel={todayLabel}
                miLiquidacion={miLiquidacion}
                tipoContrato={tipoContrato}
              />
              {/* onVerDetalles omitted — ResumenCards is immediately below */}
              <View className="px-5 gap-3">
                <TurnosEventualCard
                  aceptaExtras={aceptaExtras}
                  periodo={periodoEventual}
                  linea={miLineaEventual}
                />
                <ResumenCards
                  resumen={resumen}
                  periodos={periodos}
                  periodoActivoId={periodoActivo?.id}
                  onSeleccionarPeriodo={setPeriodoSeleccionado}
                  valorHora={valorHora}
                  miLiquidacion={miLiquidacion}
                  tipoContrato={tipoContrato}
                  misDescuentos={misDescuentos}
                  onRevisarDescuentos={() => setModalDescuentos(true)}
                />
                <View className="flex-row items-center justify-between mt-1">
                  <Text className="text-sm font-semibold text-foreground">
                    {viewMode === 'mes' ? 'Mi mes' : 'Registros del período'}
                  </Text>
                  <View className="flex-row items-center gap-3">
                    <TouchableOpacity
                      onPress={() => setViewMode(v => v === 'lista' ? 'mes' : 'lista')}
                      accessibilityLabel={viewMode === 'lista' ? 'Ver mes' : 'Ver lista'}
                      hitSlop={8}
                    >
                      <Ionicons name={viewMode === 'lista' ? 'calendar-outline' : 'list-outline'} size={18} color={theme.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => router.push('/historial-ganancias')}
                      className="flex-row items-center gap-1"
                      hitSlop={8}
                    >
                      <Text className="text-xs font-semibold" style={{ color: theme.primary }}>Historial</Text>
                      <Ionicons name="chevron-forward" size={12} color={theme.primary} />
                    </TouchableOpacity>
                  </View>
                </View>

                {viewMode === 'mes' && (
                  <View className="gap-2">
                    <NavegadorMes
                      mes={mesCursor.month}
                      anio={mesCursor.year}
                      onAnterior={mesAnterior}
                      onSiguiente={mesSiguiente}
                      onHoy={esMesActual ? undefined : () => setMesCursor(mesDeHoy())}
                    />
                    <MonthCalendar
                      weeks={mesWeeks}
                      onMesAnterior={mesAnterior}
                      onMesSiguiente={mesSiguiente}
                      renderDay={(day: CalendarDay) => {
                        const tipoDia = tipoDiaPorFecha.get(day.date);
                        const esLibre = (tipoDia && DIA_LIBRE[tipoDia]) || compensatoriosAsignadosPorFecha.has(day.date);
                        const esAusencia = tipoDia && DIA_AUSENCIA[tipoDia];
                        // Franja del período que se está liquidando: sus días y el de cierre.
                        const enPeriodo = !!periodoActivo && periodoActivo.fecha_inicio <= day.date && day.date <= periodoActivo.fecha_fin;
                        const esCierre = periodoActivo?.fecha_fin === day.date;
                        if (!esLibre && !esAusencia && !enPeriodo) return null;
                        return (
                          <View className="flex-1 -mx-1 -mb-1 mt-0 justify-end">
                            {(esLibre || esAusencia) && (
                              <View className={`flex-1 rounded-t-md items-center justify-end py-0.5 ${esLibre ? 'bg-success-light' : 'bg-warning-light'}`}>
                                <Text className="text-foreground" style={{ fontSize: 8, fontWeight: '700' }}>
                                  {esLibre ? 'Libre' : 'Ausencia'}
                                </Text>
                              </View>
                            )}
                            {enPeriodo && (
                              <View
                                className={`items-center justify-center ${esCierre ? 'h-3.5' : 'h-1'}`}
                                style={{ backgroundColor: alpha(theme.primary, esCierre ? 0.3 : 0.2) }}
                              >
                                {esCierre && <Text className="text-foreground" style={{ fontSize: 8, fontWeight: '700' }}>Cierre</Text>}
                              </View>
                            )}
                          </View>
                        );
                      }}
                    />
                    <View className="flex-row items-center gap-x-4 gap-y-1 justify-center mt-1 flex-wrap">
                      <View className="flex-row items-center gap-1.5">
                        <View className="w-3 h-1 rounded" style={{ backgroundColor: alpha(theme.primary, 0.3) }} />
                        <Text className="text-xs text-muted-foreground">Período actual</Text>
                      </View>
                      <View className="flex-row items-center gap-1.5">
                        <Ionicons name="flag" size={10} color={theme.primary} />
                        <Text className="text-xs text-muted-foreground">Festivo</Text>
                      </View>
                      <View className="flex-row items-center gap-1.5">
                        <View className="w-2.5 h-2.5 rounded bg-success-light" />
                        <Text className="text-xs text-muted-foreground">Descanso / vacaciones</Text>
                      </View>
                      <View className="flex-row items-center gap-1.5">
                        <View className="w-2.5 h-2.5 rounded bg-warning-light" />
                        <Text className="text-xs text-muted-foreground">Incapacidad / licencia</Text>
                      </View>
                    </View>
                  </View>
                )}
              </View>
            </View>
          }
          ListEmptyComponent={
            viewMode === 'mes' ? null : loadingRegistros ? (
              <SkeletonList count={3} />
            ) : (
              <EmptyState title="Sin registros aún" message="Marca tu entrada para comenzar a registrar horas." />
            )
          }
          ItemSeparatorComponent={() => <View className="h-2" />}
          contentContainerStyle={{ paddingHorizontal: 20 }}
        />
      )}

      <DescuentosPendientesModal
        visible={modalDescuentos}
        descuentos={pendientesLista}
        onClose={() => setModalDescuentos(false)}
      />
    </SafeAreaView>
  );
}
