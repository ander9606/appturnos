/**
 * NominaTrabajadorView — pantalla principal del trabajador_nomina.
 *
 * Renderiza el marcaje de jornada (entrada/salida) + resumen del período.
 * Toda la lógica de negocio vive en useNominaTrabajador + nominaTrabajadorUtils.
 */

import React, { useState, useMemo } from 'react';
import { View, Text, FlatList, ActivityIndicator, RefreshControl, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '@/lib/theme';
import { formatShortDate } from '@/lib/formatters';
import { apiErrorMessage } from '@/lib/apiErrorMessage';
import { Button } from '@/components/ui/Button';
import { RegistroCard } from '../RegistroCard';
import { PeriodoHeaderCard } from './components/PeriodoHeaderCard';
import { ResumenCards } from './components/ResumenCards';
import { IngresoHoyTab } from './components/IngresoHoyTab';
import { useNominaTrabajador } from './useNominaTrabajador';
import { calcularResumenPeriodo, analizarDia } from './nominaTrabajadorUtils';
import { useMisCompensatorios } from '../compensatorios/useCompensatorios';
import { useRegistrosHistorial } from '../useNomina';
import { MonthCalendar } from '@/components/ui/MonthCalendar';
import { getMonthGrid, type CalendarDay } from '@/lib/calendar';
import { bogotaToday } from '@/lib/formatters';
import type { TipoDia } from '@api-client';

type ActiveTab = 'hoy' | 'nomina';

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

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
  // ponytail: sin `enabled` — se dispara en cada visita a la tab Nómina (antes solo se pedía al
  // entrar a /historial-ganancias), y viene topado a 500 filas por el backend sin paginar por fecha,
  // así que un trabajador con más antigüedad puede ver meses viejos del calendario sin bandas de
  // descanso aunque sí las tuvo. Upgrade path: enabled: activeTab === 'nomina' && viewMode === 'mes'
  // (mismo patrón que useOfertas en turnos.tsx), y agregar fecha_desde/fecha_hasta a listarRegistros.
  const { data: historialResp } = useRegistrosHistorial();
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
    registroHoy,
    estadoHoy,
    todayISO,
    miLiquidacion,
    tipoContrato,
    misDescuentos,
    loading,
    loadingRegistros,
    isRefetching,
    onRefresh,
    isError,
    error,
  } = useNominaTrabajador();

  // Resumen solo de esta semana (para la card semanal del header)
  const resumenSemana = useMemo(() => {
    const hoy = new Date();
    const lunes = new Date(hoy);
    const diaSemana = hoy.getDay();
    lunes.setDate(hoy.getDate() - (diaSemana === 0 ? 6 : diaSemana - 1));
    lunes.setHours(0, 0, 0, 0);
    const semana = registros.filter((r) => new Date(`${r.fecha}T00:00:00`) >= lunes);
    return calcularResumenPeriodo(semana, valorHora);
  }, [registros, valorHora]);

  const analisisHoy = useMemo(
    () => (registroHoy ? analizarDia(registroHoy, valorHora) : null),
    [registroHoy, valorHora],
  );

  const todayLabel = formatShortDate(todayISO);

  if (loading) {
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
          {apiErrorMessage(error, 'Error al cargar tu nómina')}
        </Text>
        <Button label="Reintentar" onPress={onRefresh} variant="secondary" />
      </SafeAreaView>
    );
  }

  if (periodos.length === 0) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center gap-3 px-8" edges={['top']}>
        <Ionicons name="clipboard-outline" size={48} color="#94A3B8" />
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
              <Text className={`text-sm font-semibold ${isActive ? 'text-primary-500' : 'text-muted-foreground'}`}>
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

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
            <RegistroCard registro={item} valorHora={valorHora} />
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
                salarioBase={salarioBase}
                valorHora={valorHora}
                color={theme.primary}
                todayLabel={todayLabel}
                miLiquidacion={miLiquidacion}
                tipoContrato={tipoContrato}
              />
              {/* onVerDetalles omitted — ResumenCards is immediately below */}
              <View className="px-5 gap-3">
                <ResumenCards
                  resumen={resumen}
                  periodos={periodos}
                  periodoActivoId={periodoActivo?.id}
                  onSeleccionarPeriodo={setPeriodoSeleccionado}
                  valorHora={valorHora}
                  miLiquidacion={miLiquidacion}
                  tipoContrato={tipoContrato}
                  misDescuentos={misDescuentos}
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
                    <View className="flex-row items-center gap-3">
                      <TouchableOpacity
                        onPress={() => setMesCursor(c => c.month === 1 ? { year: c.year - 1, month: 12 } : { year: c.year, month: c.month - 1 })}
                        className="w-8 h-8 items-center justify-center rounded-lg border border-border"
                      >
                        <Ionicons name="chevron-back" size={16} color={theme.primary} />
                      </TouchableOpacity>
                      <Text className="text-sm font-semibold text-foreground flex-1 text-center">
                        {MESES[mesCursor.month - 1]} {mesCursor.year}
                      </Text>
                      <TouchableOpacity
                        onPress={() => setMesCursor(c => c.month === 12 ? { year: c.year + 1, month: 1 } : { year: c.year, month: c.month + 1 })}
                        className="w-8 h-8 items-center justify-center rounded-lg border border-border"
                      >
                        <Ionicons name="chevron-forward" size={16} color={theme.primary} />
                      </TouchableOpacity>
                    </View>
                    {/* ponytail: hex crudo (#D1FAE5/#FEF3C7/#0F172A) en vez de clases semánticas
                        bg-success-light/bg-warning-light/text-foreground — el calendario de gestor
                        (nomina.tsx) y el de web sí usan los tokens para el mismo patrón. Upgrade path:
                        cambiar style={{backgroundColor}} por className con los tokens de tailwind.config.js. */}
                    <MonthCalendar
                      weeks={mesWeeks}
                      renderDay={(day: CalendarDay) => {
                        const tipoDia = tipoDiaPorFecha.get(day.date);
                        const esLibre = (tipoDia && DIA_LIBRE[tipoDia]) || compensatoriosAsignadosPorFecha.has(day.date);
                        const esAusencia = tipoDia && DIA_AUSENCIA[tipoDia];
                        if (!esLibre && !esAusencia) return null;
                        return (
                          <View
                            className="flex-1 -m-1 mt-0 rounded-b-md items-center justify-end py-0.5"
                            style={{ backgroundColor: esLibre ? '#D1FAE5' : '#FEF3C7' }}
                          >
                            <Text style={{ fontSize: 8, fontWeight: '700', color: '#0F172A' }}>
                              {esLibre ? 'Libre' : 'Ausencia'}
                            </Text>
                          </View>
                        );
                      }}
                    />
                    <View className="flex-row items-center gap-4 justify-center mt-1">
                      <View className="flex-row items-center gap-1.5">
                        <View className="w-2.5 h-2.5 rounded" style={{ backgroundColor: '#D1FAE5' }} />
                        <Text className="text-xs text-muted-foreground">Descanso / vacaciones</Text>
                      </View>
                      <View className="flex-row items-center gap-1.5">
                        <View className="w-2.5 h-2.5 rounded" style={{ backgroundColor: '#FEF3C7' }} />
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
              <View className="py-12 items-center">
                <ActivityIndicator color={theme.primary} />
              </View>
            ) : (
              <View className="py-12 items-center gap-3 px-8">
                <Ionicons name="clipboard-outline" size={40} color="#94A3B8" />
                <Text className="text-base font-semibold text-foreground text-center">
                  Sin registros aún
                </Text>
                <Text className="text-sm text-muted-foreground text-center">
                  Marca tu entrada para comenzar a registrar horas.
                </Text>
              </View>
            )
          }
          ItemSeparatorComponent={() => <View className="h-2" />}
          contentContainerStyle={{ paddingHorizontal: 20 }}
        />
      )}
    </SafeAreaView>
  );
}
