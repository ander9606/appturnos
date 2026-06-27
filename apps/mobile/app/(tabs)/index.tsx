/**
 * Dashboard — Tab "Inicio"
 *
 * Diseño dual:
 *  - Trabajador  → turno activo/próximo, mis stats del período, próximos turnos
 *  - Gestor/Admin → stats del equipo, período abierto, acciones rápidas
 *
 * Colores: naranja (trabajador_turnos), verde (trabajador_nomina), azul (gestores).
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  RefreshControl,
  Linking,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { empresasApi } from '@api-client';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { Ionicons } from '@expo/vector-icons';

import { useAuthStore } from '@/features/auth/useAuthStore';
import { useTheme }     from '@/lib/theme';
import { useMisTurnos, useOfertas, useAsignacionesHoy } from '@/features/turnos/useTurnos';
import { useTrabajadores } from '@/features/equipo/useEquipo';
import { usePeriodos, useNominaPerfil } from '@/features/nomina/useNomina';
import { useCountNoLeidas } from '@/features/notificaciones/useNotificaciones';
import { bogotaToday, fmtTime, getEstadoConfig } from '@/features/turnos/turnosUtils';
import { t } from '@/lib/i18n';
import { StatCard }       from '@/components/ui/StatCard';
import { ActiveShiftCard } from '@/features/dashboard/ActiveShiftCard';
import { NextShiftCard }   from '@/features/dashboard/NextShiftCard';
import { NoShiftCard }     from '@/features/dashboard/NoShiftCard';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

// ── Constants ─────────────────────────────────────────────────────────────

const WORKER_ROLES = ['trabajador_turnos', 'trabajador_nomina'];
const MANAGE_ROLES = ['admin_empresa', 'jefe_turnos', 'jefe_nomina', 'nomina'];

const ROL_LABEL: Record<string, string> = {
  admin_empresa:      'Administrador',
  jefe_turnos:        'Jefe de Turnos',
  jefe_nomina:        'Jefe de Nómina',
  nomina:             'Nómina',
  trabajador_turnos:  'Trabajador · Turnos',
  trabajador_nomina:  'Trabajador · Nómina',
};

// ── Screen ────────────────────────────────────────────────────────────────

export default function DashboardScreen() {
  const router  = useRouter();
  const usuario = useAuthStore((s) => s.usuario);
  const theme   = useTheme();

  const isWorker      = WORKER_ROLES.includes(usuario?.rol ?? '');
  const isManager     = MANAGE_ROLES.includes(usuario?.rol ?? '');
  const isAdmin       = usuario?.rol === 'admin_empresa';
  const isNomina      = usuario?.rol === 'trabajador_nomina';
  const isJefeNomina  = usuario?.rol === 'jefe_nomina';

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? t('dashboard.greeting')
    : hour < 20 ? t('dashboard.greetingEvening')
    : t('dashboard.greetingNight');

  const today = bogotaToday();

  // ── Data fetching ────────────────────────────────────────────────────────

  // Only trabajador_turnos gets the shift hero — managers/admin have no own shifts
  const showShifts = isWorker && !isNomina;

  const {
    data: turnos = [],
    isLoading: turnosLoading,
    refetch: refetchTurnos,
  } = useMisTurnos({ enabled: showShifts });

  const {
    data: equipoData,
    refetch: refetchEquipo,
  } = useTrabajadores({ activo: true, enabled: isManager });
  const totalEquipo = isManager ? (equipoData?.pagination?.total ?? null) : null;

  const {
    data: periodosData,
    refetch: refetchPeriodos,
  } = usePeriodos('abierto');
  const periodoAbierto = periodosData?.data?.[0] ?? null;

  const { data: nominaPerfil, refetch: refetchNominaPerfil } = useNominaPerfil();

  const {
    data: ofertasHoyData,
    refetch: refetchOfertasHoy,
  } = useOfertas({ fecha: today }, { enabled: isManager });

  const {
    data: asignacionesHoy,
    refetch: refetchAsignacionesHoy,
  } = useAsignacionesHoy({ enabled: isManager });

  const noLeidas = useCountNoLeidas();

  const { data: suscData } = useQuery({
    queryKey: ['empresa', 'suscripcion'],
    queryFn: () => empresasApi.obtenerSuscripcion(),
    enabled: isManager,
    staleTime: 5 * 60_000,
  });
  const suscVencida = isManager && suscData?.activa === false;

  // ── Pull to refresh ──────────────────────────────────────────────────────

  const [refreshing, setRefreshing] = useState(false);
  async function onRefresh() {
    setRefreshing(true);
    await Promise.all([
      showShifts ? refetchTurnos() : Promise.resolve(),
      refetchEquipo(),
      refetchPeriodos(),
      isNomina ? refetchNominaPerfil() : Promise.resolve(),
      isManager ? refetchOfertasHoy() : Promise.resolve(),
      isManager ? refetchAsignacionesHoy() : Promise.resolve(),
    ]);
    setRefreshing(false);
  }

  // ── Derive shift data ────────────────────────────────────────────────────

  const turnoActivo = turnos.find((a) => a.estado === 'en_progreso') ?? null;

  const proximoHoy = !turnoActivo
    ? (turnos
        .filter((a) => a.oferta_fecha === today && a.estado === 'confirmado')
        .sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio))[0] ?? null)
    : null;

  const turnosHoy = turnos.filter(
    (a) =>
      a.oferta_fecha === today &&
      a.estado !== 'cancelado' &&
      a.estado !== 'no_presentado',
  );

  const proximos = turnos
    .filter(
      (a) =>
        a.oferta_fecha > today &&
        (a.estado === 'confirmado' || a.estado === 'pendiente'),
    )
    .sort((a, b) => a.oferta_fecha.localeCompare(b.oferta_fecha))
    .slice(0, 3);

  // ── Stats ────────────────────────────────────────────────────────────────

  const stats: { value: string | number; label: string; color: string; onPress?: () => void }[] = isNomina
    ? [
        { value: periodoAbierto ? '✓' : '—', label: 'Período activo', color: periodoAbierto ? 'text-success' : 'text-muted-foreground', onPress: () => router.push('/(tabs)/nomina') },
        { value: nominaPerfil?.acepta_extras ? '✓' : '—',             label: 'Extras activos', color: nominaPerfil?.acepta_extras ? 'text-info' : 'text-muted-foreground', onPress: () => router.push('/(tabs)/nomina') },
        { value: turnosHoy.length > 0 ? turnosHoy.length : '—',       label: 'Extras hoy', color: 'text-foreground', onPress: () => router.push('/(tabs)/turnos') },
      ]
    : isWorker
    ? [
        { value: turnosHoy.length,                                          label: 'Turnos hoy',  color: 'text-foreground', onPress: () => router.push('/(tabs)/turnos') },
        { value: proximos.length,                                           label: 'Próximos',    color: 'text-info',       onPress: () => router.push('/(tabs)/turnos') },
        { value: turnos.filter((a) => a.estado === 'completado').length,    label: 'Completados', color: 'text-success',    onPress: () => router.push('/(tabs)/turnos') },
      ]
    : isJefeNomina
    ? [
        { value: totalEquipo ?? '…',          label: 'Empleados',      color: 'text-info',                                                              onPress: () => router.push('/(tabs)/equipo') },
        { value: periodoAbierto ? '✓' : '—',  label: 'Período activo', color: periodoAbierto ? 'text-success' : 'text-muted-foreground',                onPress: () => router.push('/(tabs)/nomina') },
        { value: periodoAbierto?.tipo ?? '—', label: 'Ciclo',          color: 'text-foreground',                                                        onPress: () => router.push('/(tabs)/nomina') },
      ]
    : [
        { value: totalEquipo ?? '…',                                                                                                                                                                      label: t('dashboard.statEmployees'),   color: 'text-info',       onPress: () => router.push('/(tabs)/equipo') },
        { value: ofertasHoyData?.pagination?.total ?? '…', label: t('dashboard.statShiftsToday'), color: 'text-foreground', onPress: () => router.push('/(tabs)/turnos') },
        { value: periodoAbierto ? `${new Date(periodoAbierto.fecha_inicio + 'T00:00:00').getDate()}–${new Date(periodoAbierto.fecha_fin + 'T00:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}` : '—', label: 'Período', color: periodoAbierto ? 'text-success' : 'text-muted-foreground', onPress: () => router.push('/(tabs)/nomina') },
      ];

  // ── Quick actions ────────────────────────────────────────────────────────

  type Action = { icon: IoniconsName; label: string; onPress: () => void };

  const workerActions: Action[] = isNomina
    ? [
        { icon: 'wallet-outline',   label: 'Mi Nómina',  onPress: () => router.push('/(tabs)/nomina') },
        { icon: 'calendar-outline', label: 'Mis Turnos', onPress: () => router.push('/(tabs)/turnos') },
      ]
    : [
        { icon: 'calendar-outline', label: 'Mis Turnos', onPress: () => router.push('/(tabs)/turnos') },
        { icon: 'wallet-outline',   label: 'Quincena',   onPress: () => router.push('/(tabs)/nomina') },
      ];

  const managerActions: Action[] = isJefeNomina
    ? [
        { icon: 'wallet-outline',        label: 'Nómina',        onPress: () => router.push('/(tabs)/nomina') },
        { icon: 'people-outline',        label: 'Asistencia',    onPress: () => router.push('/dashboard-asistencia') },
        { icon: 'briefcase-outline',     label: 'Trim. eventual',onPress: () => router.push('/liquidacion-eventual') },
        { icon: 'calendar-outline',      label: 'Registros',     onPress: () => router.push('/registros-periodo') },
      ]
    : [
        { icon: 'calendar-outline',      label: 'Turnos',      onPress: () => router.push('/(tabs)/turnos') },
        { icon: 'wallet-outline',        label: 'Nómina',      onPress: () => router.push('/(tabs)/nomina') },
        { icon: 'people-outline',        label: 'Equipo',      onPress: () => router.push('/(tabs)/equipo') },
        ...(isAdmin
          ? [
              { icon: 'cash-outline'        as IoniconsName, label: 'Liq. turnos',  onPress: () => router.push('/liquidacion-turnos') },
              { icon: 'person-add-outline'  as IoniconsName, label: 'Agregar emp.', onPress: () => router.push('/trabajador/nuevo') },
              { icon: 'link-outline'        as IoniconsName, label: 'logiq360',     onPress: () => router.push('/integracion/config') },
            ]
          : [
              { icon: 'pulse-outline'       as IoniconsName, label: 'Estado sync',  onPress: () => router.push('/integracion/estado') },
            ]),
      ];

  const actions: Action[] = isWorker ? workerActions : managerActions;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.primary}
            colors={[theme.primary]}
          />
        }
      >
        {/* ── Banner suscripción vencida ──────────────────────────────── */}
        {suscVencida && (
          <Pressable
            onPress={() => Linking.openURL('mailto:soporte@zaturno.app')}
            className="mx-4 mt-4 flex-row items-center gap-3 bg-danger-light border border-danger/30 rounded-2xl px-4 py-3"
            accessibilityRole="button"
          >
            <Ionicons name="alert-circle" size={20} color="#ef4444" />
            <View className="flex-1">
              <Text className="text-danger text-sm font-semibold">Suscripción vencida</Text>
              <Text className="text-danger/80 text-xs mt-0.5">
                Tienes 3 días de gracia. Toca aquí para renovar.
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#ef4444" />
          </Pressable>
        )}

        {/* ── Header ──────────────────────────────────────────────────── */}
        <View
          className="pt-4 pb-8 px-6 rounded-b-[32px] gap-1"
          style={{ backgroundColor: theme.primary }}
        >
          <Text className="text-white/80 text-sm font-medium">{greeting}</Text>
          <View className="flex-row items-center justify-between">
            <Text className="text-white text-2xl font-bold">
              {usuario?.nombre ?? '…'}
            </Text>
            <Pressable
              onPress={() => router.push('/notificaciones')}
              className="w-10 h-10 rounded-xl bg-white/20 items-center justify-center"
              accessibilityRole="button"
              accessibilityLabel={`Notificaciones${noLeidas > 0 ? `, ${noLeidas} sin leer` : ''}`}
            >
              <Ionicons name="notifications-outline" size={20} color="white" />
              {noLeidas > 0 && (
                <View className="absolute -top-1 -right-1 min-w-[16px] h-4 rounded-full bg-danger items-center justify-center px-0.5">
                  <Text className="text-white text-[9px] font-bold leading-none">
                    {noLeidas > 99 ? '99+' : noLeidas}
                  </Text>
                </View>
              )}
            </Pressable>
          </View>
          <Text className="text-white/60 text-xs">
            {ROL_LABEL[usuario?.rol ?? ''] ?? usuario?.rol?.replace(/_/g, ' ')}
          </Text>
        </View>

        {/* ── Hero: turno activo / próximo / vacío (solo turnos) ─────── */}
        {showShifts && (
          turnoActivo ? (
            <ActiveShiftCard
              turno={turnoActivo}
              primaryColor={theme.primary}
              onPress={() => router.push(`/turno/${turnoActivo.id}`)}
              onEgreso={() => router.push(`/egreso/${turnoActivo.id}`)}
            />
          ) : proximoHoy ? (
            <NextShiftCard
              turno={proximoHoy}
              primaryColor={theme.primary}
              onPress={() => router.push(`/turno/${proximoHoy.id}`)}
              onIngreso={() => router.push(`/ingreso/${proximoHoy.id}`)}
            />
          ) : (
            <NoShiftCard />
          )
        )}

        {/* ── Hero: nomina day card ────────────────────────────────────── */}
        {isNomina && (
          <Pressable
            onPress={() => router.push('/(tabs)/nomina')}
            className="mx-4 mt-4 flex-row items-center gap-3 rounded-2xl px-4 py-4 active:opacity-80 border"
            style={{ backgroundColor: theme.primaryLight, borderColor: theme.primary + '4D' }}
          >
            <View
              className="w-10 h-10 rounded-xl items-center justify-center"
              style={{ backgroundColor: theme.primary + '22' }}
            >
              <Ionicons name="time-outline" size={22} color={theme.primary} />
            </View>
            <View className="flex-1">
              <Text className="text-sm font-semibold" style={{ color: theme.primary }}>
                Marcaje de jornada
              </Text>
              <Text className="text-xs" style={{ color: theme.primary + 'BB' }}>
                Toca para marcar entrada / salida →
              </Text>
            </View>
          </Pressable>
        )}


        {/* ── Resumen turnos hoy (managers) ───────────────────────────── */}
        {isManager && (
          <Pressable
            onPress={() => router.push('/(tabs)/turnos')}
            className="mx-4 mt-4 flex-row items-center gap-4 rounded-2xl px-4 py-3 border border-border bg-card active:opacity-80"
          >
            <Ionicons name="people-outline" size={22} color={theme.primary} />
            <View className="flex-1">
              <Text className="text-sm font-semibold text-foreground">
                {ofertasHoyData?.pagination?.total ?? '…'} {(ofertasHoyData?.pagination?.total ?? 0) === 1 ? 'turno' : 'turnos'} programados
              </Text>
              <View className="flex-row gap-4 mt-0.5">
                <View className="flex-row items-center gap-1">
                  <View className="w-2 h-2 rounded-full bg-success" />
                  <Text className="text-xs text-muted-foreground">
                    {asignacionesHoy?.data?.filter((a) => a.estado === 'en_progreso').length ?? '…'} en progreso
                  </Text>
                </View>
                <View className="flex-row items-center gap-1">
                  <View className="w-2 h-2 rounded-full bg-info" />
                  <Text className="text-xs text-muted-foreground">
                    {asignacionesHoy?.data?.filter((a) => a.estado === 'confirmado').length ?? '…'} por empezar
                  </Text>
                </View>
              </View>
            </View>
            <Text className="text-muted-foreground">›</Text>
          </Pressable>
        )}

        {/* ── Stat cards ───────────────────────────────────────────────── */}
        <View className="flex-row px-4 mt-4 gap-3">
          {stats.map((s) => (
            <StatCard key={s.label} value={s.value} label={s.label} color={s.color} onPress={s.onPress} />
          ))}
        </View>

        {/* ── Quick actions ────────────────────────────────────────────── */}
        <View className="px-4 mt-5 gap-3">
          <Text className="text-base font-semibold text-foreground">
            {t('dashboard.quickActions')}
          </Text>
          <View className="flex-row flex-wrap gap-3">
            {actions.map((a) => (
              <Pressable
                key={a.label}
                onPress={a.onPress}
                className="bg-card border border-border rounded-2xl p-4 items-center gap-2 active:opacity-70"
                style={{ width: actions.length <= 2 ? '47%' : '22%' }}
              >
                <View
                  className="w-10 h-10 rounded-xl items-center justify-center"
                  style={{ backgroundColor: theme.primary + '1A' }}
                >
                  <Ionicons name={a.icon} size={20} color={theme.primary} />
                </View>
                <Text className="text-[10px] font-semibold text-foreground text-center">
                  {a.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* ── Próximos turnos (workers) ────────────────────────────────── */}
        {showShifts && proximos.length > 0 && (
          <View className="px-4 mt-5 gap-3">
            <View className="flex-row items-center justify-between">
              <Text className="text-base font-semibold text-foreground">
                {t('dashboard.upcomingShifts')}
              </Text>
              <Pressable onPress={() => router.push('/(tabs)/turnos')}>
                <Text className="text-sm font-semibold" style={{ color: theme.primary }}>
                  {t('dashboard.seeAll')}
                </Text>
              </Pressable>
            </View>

            {proximos.map((turno) => {
              const cfg = getEstadoConfig(turno.estado);
              return (
                <Pressable
                  key={turno.id}
                  onPress={() => router.push(`/turno/${turno.id}`)}
                  className="bg-card border border-border rounded-2xl px-4 py-3 flex-row items-center gap-3 active:opacity-80"
                >
                  <View
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: cfg.accentColor }}
                  />
                  <View className="flex-1">
                    <Text className="text-sm font-semibold text-foreground" numberOfLines={1}>
                      {turno.oferta_titulo}
                    </Text>
                    <Text className="text-xs text-muted-foreground">
                      {new Date(turno.oferta_fecha + 'T00:00:00').toLocaleDateString('es-CO', {
                        weekday: 'short', day: 'numeric', month: 'short',
                      })}
                      {'  ·  '}
                      {fmtTime(turno.hora_inicio)}
                      {turno.hora_fin_estimada ? ` – ${fmtTime(turno.hora_fin_estimada)}` : ''}
                    </Text>
                  </View>
                  <Text className="text-muted-foreground text-xs">›</Text>
                </Pressable>
              );
            })}
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}
