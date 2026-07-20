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
  Alert,
} from 'react-native';
import { useQuery, useMutation } from '@tanstack/react-query';
import { empresasApi, ApiError } from '@api-client';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { Ionicons } from '@expo/vector-icons';

import { useAuthStore } from '@/features/auth/useAuthStore';
import { useTheme }     from '@/lib/theme';
import { useMisTurnos, useOfertas, useAsignacionesHoy, useCargos } from '@/features/turnos/useTurnos';
import { usePuntosMarcaje } from '@/features/turnos/usePuntosMarcaje';
import { useTrabajadores } from '@/features/equipo/useEquipo';
import { usePeriodos, useNominaPerfil } from '@/features/nomina/useNomina';
import { useCountNoLeidas } from '@/features/notificaciones/useNotificaciones';
import { bogotaToday, fmtTime, getEstadoConfig } from '@/features/turnos/turnosUtils';
import { t } from '@/lib/i18n';
import { StatCard }       from '@/components/ui/StatCard';
import { Avatar }         from '@/components/ui/Avatar';
import { ActiveShiftCard } from '@/features/dashboard/ActiveShiftCard';
import { NextShiftCard }   from '@/features/dashboard/NextShiftCard';
import { NoShiftCard }     from '@/features/dashboard/NoShiftCard';
import { SetupChecklist }  from '@/features/dashboard/SetupChecklist';
import { fmtPeriodo }      from '@/features/nomina/trabajador/nominaTrabajadorUtils';
import { formatShortDate } from '@/lib/formatters';

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
  // Backend restringe GET /nomina/periodos a admin_empresa/jefe_nomina/nomina/trabajador_nomina (no jefe_turnos).
  const puedeVerPeriodos = ['admin_empresa', 'jefe_nomina', 'nomina', 'trabajador_nomina'].includes(usuario?.rol ?? '');
  // Backend restringe GET /ofertas a todos los roles gestores menos 'nomina'.
  const puedeVerOfertas = isManager && usuario?.rol !== 'nomina';
  // Backend restringe GET /asignaciones (hoy) a admin_empresa/jefe_turnos únicamente.
  const puedeVerAsignacionesHoy = usuario?.rol === 'admin_empresa' || usuario?.rol === 'jefe_turnos';

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? t('dashboard.greeting')
    : hour < 20 ? t('dashboard.greetingEvening')
    : t('dashboard.greetingNight');

  const today = bogotaToday();

  // ── Data fetching ────────────────────────────────────────────────────────

  const { data: nominaPerfil, refetch: refetchNominaPerfil } = useNominaPerfil(isNomina);

  // Only trabajador_turnos gets the shift hero — managers/admin have no own shifts.
  // trabajador_nomina con "acepta_extras" también necesita esta data para el stat "Extras hoy",
  // aunque no vea el hero de turnos (showShifts controla eso por separado).
  const showShifts = isWorker && !isNomina;
  const necesitaExtrasHoy = isNomina && Boolean(nominaPerfil?.acepta_extras);

  const {
    data: turnos = [],
    isLoading: turnosLoading,
    refetch: refetchTurnos,
  } = useMisTurnos({ enabled: showShifts || necesitaExtrasHoy });

  const {
    data: equipoData,
    refetch: refetchEquipo,
  } = useTrabajadores({ activo: true, enabled: isManager });
  const totalEquipo = isManager ? (equipoData?.pagination?.total ?? null) : null;

  const {
    data: periodosData,
    refetch: refetchPeriodos,
  } = usePeriodos('abierto', puedeVerPeriodos);
  const periodoAbierto = periodosData?.data?.[0] ?? null;

  const {
    data: ofertasHoyData,
    refetch: refetchOfertasHoy,
  } = useOfertas({ fecha: today }, { enabled: puedeVerOfertas });

  const {
    data: asignacionesHoy,
    refetch: refetchAsignacionesHoy,
  } = useAsignacionesHoy({ enabled: puedeVerAsignacionesHoy });

  // ── Checklist de primeros pasos (solo admin_empresa) ─────────────────────
  const { data: cargosData }   = useCargos(isAdmin);
  const { data: puntosData }   = usePuntosMarcaje(isAdmin);
  const { data: todasOfertas } = useOfertas({ limit: 1 }, { enabled: isAdmin });

  const noLeidas = useCountNoLeidas();

  const { data: suscData } = useQuery({
    queryKey: ['empresa', 'suscripcion'],
    queryFn: () => empresasApi.obtenerSuscripcion(),
    enabled: isManager,
    staleTime: 5 * 60_000,
  });
  const suscVencida       = isManager && suscData?.activa === false;
  const logiq360Conectado = isManager && suscData?.logiq360_conectado === true;
  // Solo admin_empresa puede pagar, y solo si la empresa no la factura logiq360.
  const puedeAutopagar    = isAdmin && !logiq360Conectado;
  // Aviso suave de renovación próxima — no aplica si logiq360 cubre la cuenta.
  const suscPorVencer =
    isManager && !logiq360Conectado && suscData?.activa === true &&
    suscData?.dias_restantes !== null && (suscData?.dias_restantes ?? 99) <= 3;

  const pagarMutation = useMutation({
    mutationFn: () => empresasApi.generarLinkPago(),
    // Link hospedado por Wompi, se abre en el navegador del sistema — no un webview embebido.
    onSuccess: (data) => Linking.openURL(data.url),
    onError: (error: ApiError) =>
      Alert.alert('No se pudo generar el link de pago', error.message || 'Intenta de nuevo o contacta a soporte.'),
  });

  function iniciarRenovacion() {
    if (!isAdmin) {
      // Solo el admin_empresa puede pagar — el resto solo puede avisarle.
      Linking.openURL('mailto:soporte@zaturno.app');
      return;
    }
    pagarMutation.mutate();
  }

  // ── Pull to refresh ──────────────────────────────────────────────────────

  const [refreshing, setRefreshing] = useState(false);
  async function onRefresh() {
    setRefreshing(true);
    await Promise.all([
      (showShifts || necesitaExtrasHoy) ? refetchTurnos() : Promise.resolve(),
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
        { value: periodoAbierto ? fmtPeriodo(periodoAbierto) : '—', label: 'Período', color: periodoAbierto ? 'text-success' : 'text-muted-foreground', onPress: () => router.push('/(tabs)/nomina') },
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
        { value: periodoAbierto ? fmtPeriodo(periodoAbierto) : '—',  label: 'Período', color: periodoAbierto ? 'text-success' : 'text-muted-foreground',                onPress: () => router.push('/(tabs)/nomina') },
        { value: periodoAbierto?.tipo ?? '—', label: 'Ciclo',          color: 'text-foreground',                                                        onPress: () => router.push('/(tabs)/nomina') },
      ]
    : [
        { value: totalEquipo ?? '…',                                                                                                                                                                      label: t('dashboard.statEmployees'),   color: 'text-info',       onPress: () => router.push('/(tabs)/equipo') },
        { value: ofertasHoyData?.pagination?.total ?? '…', label: t('dashboard.statShiftsToday'), color: 'text-foreground', onPress: () => router.push('/(tabs)/turnos') },
        { value: periodoAbierto ? fmtPeriodo(periodoAbierto) : '—', label: 'Período', color: periodoAbierto ? 'text-success' : 'text-muted-foreground', onPress: () => router.push('/(tabs)/nomina') },
      ];

  // ── Quick actions ────────────────────────────────────────────────────────

  type Action = { icon: IoniconsName; label: string; onPress: () => void };

  const workerActions: Action[] = isNomina
    ? [
        { icon: 'wallet-outline',   label: 'Mi Nómina',  onPress: () => router.push('/(tabs)/nomina') },
        { icon: 'calendar-outline', label: 'Mis Turnos', onPress: () => router.push('/(tabs)/turnos') },
      ]
    : [
        { icon: 'calendar-outline', label: 'Mis Turnos',     onPress: () => router.push('/(tabs)/turnos') },
        { icon: 'wallet-outline',   label: 'Quincena',       onPress: () => router.push('/(tabs)/nomina') },
        { icon: 'star-outline',     label: 'Mi calificación', onPress: () => router.push('/mis-empresas') },
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
              { icon: 'briefcase-outline'   as IoniconsName, label: 'Cargos',       onPress: () => router.push('/cargos') },
              { icon: 'location-outline'    as IoniconsName, label: 'Puntos marcaje', onPress: () => router.push('/puntos-marcaje') },
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
            onPress={iniciarRenovacion}
            disabled={pagarMutation.isPending}
            className="mx-4 mt-4 flex-row items-center gap-3 bg-danger-light border border-danger/30 rounded-2xl px-4 py-3"
            accessibilityRole="button"
          >
            <Ionicons name="alert-circle" size={20} color="#ef4444" />
            <View className="flex-1">
              <Text className="text-danger text-sm font-semibold">Suscripción vencida</Text>
              <Text className="text-danger/80 text-xs mt-0.5">
                {puedeAutopagar
                  ? pagarMutation.isPending
                    ? 'Generando link de pago…'
                    : 'Tienes 3 días de gracia. Toca aquí para pagar y renovar.'
                  : 'Tienes 3 días de gracia. Toca aquí para renovar.'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#ef4444" />
          </Pressable>
        )}

        {/* ── Banner aviso suave: vence pronto (no aplica si logiq360 cubre) ── */}
        {!suscVencida && suscPorVencer && (
          <Pressable
            onPress={iniciarRenovacion}
            disabled={pagarMutation.isPending}
            className="mx-4 mt-4 flex-row items-center gap-3 bg-warning-light border border-warning/30 rounded-2xl px-4 py-3"
            accessibilityRole="button"
          >
            <Ionicons name="time-outline" size={20} color="#d97706" />
            <View className="flex-1">
              <Text className="text-warning text-sm font-semibold">Tu suscripción vence pronto</Text>
              <Text className="text-warning/80 text-xs mt-0.5">
                Quedan {suscData?.dias_restantes} día{suscData?.dias_restantes === 1 ? '' : 's'}. Toca aquí para renovar.
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#d97706" />
          </Pressable>
        )}

        {/* ── Aviso informativo: gratis vía logiq360 ──────────────────── */}
        {logiq360Conectado && (
          <View
            className="mx-4 mt-4 flex-row items-center gap-3 bg-success-light border border-success/30 rounded-2xl px-4 py-3"
          >
            <Ionicons name="link" size={20} color="#16a34a" />
            <Text className="text-success text-sm font-medium flex-1">
              Usas Zaturno gratis por tu integración activa con logiq360.
            </Text>
          </View>
        )}

        {/* ── Checklist de primeros pasos (solo admin_empresa) ──────────── */}
        {isAdmin && (
          <SetupChecklist
            steps={[
              { label: 'Crea un cargo',                 done: (cargosData?.length ?? 0) > 0,     onPress: () => router.push('/cargos') },
              { label: 'Agrega un punto de marcaje',     done: (puntosData?.length ?? 0) > 0,     onPress: () => router.push('/puntos-marcaje') },
              { label: 'Agrega tu primer trabajador',    done: (totalEquipo ?? 0) > 0,            onPress: () => router.push('/trabajador/nuevo') },
              { label: 'Publica tu primer turno',        done: (todasOfertas?.pagination?.total ?? 0) > 0, onPress: () => router.push('/turno/nuevo') },
            ]}
          />
        )}

        {/* ── Header ──────────────────────────────────────────────────── */}
        <View
          className="pt-4 pb-8 px-6 rounded-b-[32px] gap-1"
          style={{ backgroundColor: theme.primary }}
        >
          <Text className="text-white/80 text-sm font-medium">{greeting}</Text>
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-2 flex-1">
              <Avatar
                id={usuario?.id}
                nombre={usuario?.nombre}
                apellido={usuario?.apellido}
                fotoB64={usuario?.foto_perfil}
                size={36}
                expandable
              />
              <Text className="text-white text-2xl font-bold" numberOfLines={1}>
                {usuario?.nombre ?? '…'}
              </Text>
            </View>
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

        {/* ── Estado de suscripción (discreto, solo caso normal activa) ── */}
        {isManager && !logiq360Conectado && !suscVencida && !suscPorVencer && suscData?.activa && (
          <Pressable
            onPress={iniciarRenovacion}
            disabled={pagarMutation.isPending}
            className="flex-row items-center justify-center gap-1.5 mx-4 mt-4 py-2 rounded-full bg-card border border-border active:opacity-60"
            accessibilityRole="button"
          >
            <Ionicons name="checkmark-circle-outline" size={13} color="#9CA3AF" />
            <Text className="text-xs text-muted-foreground">
              Suscripción activa
              {suscData.vigente_hasta ? ` · vence el ${formatShortDate(suscData.vigente_hasta)}` : ''}
            </Text>
          </Pressable>
        )}

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
