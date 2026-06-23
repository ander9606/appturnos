/**
 * NominaTrabajadorView — pantalla principal del trabajador_nomina.
 *
 * Renderiza el marcaje de jornada (entrada/salida) + resumen del período.
 * Toda la lógica de negocio vive en useNominaTrabajador + nominaTrabajadorUtils.
 */

import React, { useState, useMemo } from 'react';
import { View, Text, FlatList, ActivityIndicator, RefreshControl, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '@/lib/theme';
import { formatShortDate } from '@/lib/formatters';
import { RegistroCard } from '../RegistroCard';
import { PeriodoHeaderCard } from './components/PeriodoHeaderCard';
import { ResumenCards } from './components/ResumenCards';
import { IngresoHoyTab } from './components/IngresoHoyTab';
import { useNominaTrabajador } from './useNominaTrabajador';
import { calcularResumenPeriodo, analizarDia } from './nominaTrabajadorUtils';
import { useCompensatoriosPendientes } from '../compensatorios/useCompensatorios';

type ActiveTab = 'hoy' | 'nomina';

export function NominaTrabajadorView() {
  const theme = useTheme();
  const { data: compensatorios = [] } = useCompensatoriosPendientes();
  const [activeTab, setActiveTab] = useState<ActiveTab>('hoy');

  const {
    valorHora,
    salarioBase,
    tipoMarcacion,
    cargo,
    puntoMarcaje,
    periodos,
    periodoActivo,
    setPeriodoSeleccionado,
    registros,
    resumen,
    registroHoy,
    estadoHoy,
    todayISO,
    loading,
    loadingRegistros,
    isRefetching,
    onRefresh,
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
          tipoMarcacion={tipoMarcacion}
          estadoHoy={estadoHoy}
          periodoAbierto={periodoActivo?.estado === 'abierto'}
          registroHoy={registroHoy}
          compensatorios={compensatorios}
          isRefetching={isRefetching}
          onRefresh={onRefresh}
          primaryColor={theme.primary}
        />
      ) : (
        /* ── Tab: Mi Nómina ──────────────────────────────── */
        <FlatList
          data={registros}
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
              />
              <View className="px-5 gap-3">
                <ResumenCards
                  resumen={resumen}
                  periodos={periodos}
                  periodoActivoId={periodoActivo?.id}
                  onSeleccionarPeriodo={setPeriodoSeleccionado}
                  valorHora={valorHora}
                />
                <Text className="text-sm font-semibold text-foreground mt-1">
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
