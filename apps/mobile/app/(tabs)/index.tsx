/**
 * Dashboard — Tab "Inicio"
 *
 * Diseño dual:
 *  - Trabajador  → turno activo/próximo, mis stats del período, próximos turnos
 *  - Gestor/Admin → stats del equipo, período abierto, acciones rápidas
 */
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { useAuthStore } from '@/features/auth/useAuthStore';
import { useMisTurnos } from '@/features/turnos/useTurnos';
import { useTrabajadores } from '@/features/equipo/useEquipo';
import { usePeriodos } from '@/features/nomina/useNomina';
import { toISODate, fmtTime, fmtRange, getEstadoConfig } from '@/features/turnos/turnosUtils';
import { t } from '@/lib/i18n';
import type { Asignacion } from '@api-client';

// ── Constants ─────────────────────────────────────────────────────────────

const WORKER_ROLES = ['trabajador_turnos', 'trabajador_nomina'];
const MANAGE_ROLES = ['admin_empresa', 'jefe_turnos', 'jefe_nomina', 'nomina'];

// ── Helpers ───────────────────────────────────────────────────────────────

/** Calcula el progreso del turno activo (0-100). */
function calcProgress(inicio: string, fin: string | null): number {
  if (!fin) return 0;
  const now   = new Date();
  const [ih, im] = inicio.split(':').map(Number);
  const [fh, fm] = fin.split(':').map(Number);
  const start = new Date(); start.setHours(ih, im, 0, 0);
  const end   = new Date(); end.setHours(fh, fm, 0, 0);
  const total   = end.getTime() - start.getTime();
  const elapsed = now.getTime() - start.getTime();
  if (total <= 0) return 100;
  return Math.max(0, Math.min(100, (elapsed / total) * 100));
}

function minutesLeft(fin: string): number {
  const [fh, fm] = fin.split(':').map(Number);
  const end = new Date(); end.setHours(fh, fm, 0, 0);
  return Math.max(0, Math.round((end.getTime() - Date.now()) / 60_000));
}

function hoursLabel(mins: number): string {
  if (mins < 60) return `${mins}min restantes`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}min restantes` : `${h}h restantes`;
}

// ── Sub-components ────────────────────────────────────────────────────────

/** Tarjeta del turno activo (en_progreso) */
function ActiveShiftCard({
  turno,
  onPress,
}: {
  turno: Asignacion;
  onPress: () => void;
}) {
  const [pct, setPct] = useState(() =>
    calcProgress(turno.hora_inicio, turno.hora_fin_estimada),
  );
  const [minsLeft, setMinsLeft] = useState(() =>
    turno.hora_fin_estimada ? minutesLeft(turno.hora_fin_estimada) : null,
  );

  // Tick each minute
  useEffect(() => {
    const id = setInterval(() => {
      setPct(calcProgress(turno.hora_inicio, turno.hora_fin_estimada));
      if (turno.hora_fin_estimada) setMinsLeft(minutesLeft(turno.hora_fin_estimada));
    }, 60_000);
    return () => clearInterval(id);
  }, [turno.hora_inicio, turno.hora_fin_estimada]);

  return (
    <Pressable
      onPress={onPress}
      className="mx-4 mt-4 bg-primary rounded-2xl p-5 gap-3 active:opacity-90"
    >
      <View className="flex-row items-center justify-between">
        <Text className="text-white/80 text-xs font-semibold uppercase tracking-wide">
          {t('dashboard.activeShift')}
        </Text>
        <View className="bg-white/20 rounded-full px-3 py-1 flex-row items-center gap-1">
          <View className="w-1.5 h-1.5 rounded-full bg-white" />
          <Text className="text-white text-xs font-semibold">{t('dashboard.inProgress')}</Text>
        </View>
      </View>

      <Text className="text-white text-xl font-bold" numberOfLines={1}>
        {turno.oferta_titulo}
      </Text>

      <Text className="text-white/80 text-sm">
        {fmtRange(turno.hora_inicio, turno.hora_fin_estimada)}
        {turno.lugar ? `  ·  ${turno.lugar}` : ''}
      </Text>

      {/* Progress bar */}
      <View className="h-1.5 bg-white/30 rounded-full overflow-hidden">
        <View
          className="h-full bg-white rounded-full"
          style={{ width: `${Math.round(pct)}%` }}
        />
      </View>

      <Text className="text-white/70 text-xs">
        {minsLeft != null ? hoursLabel(minsLeft) : ''}
        {'  ·  '}
        {pct.toFixed(0)}% completado
      </Text>
    </Pressable>
  );
}

/** Tarjeta del próximo turno confirmado hoy */
function NextShiftCard({
  turno,
  onPress,
}: {
  turno: Asignacion;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="mx-4 mt-4 bg-card rounded-2xl p-5 border border-border gap-2 active:opacity-80"
    >
      <View className="flex-row items-center justify-between">
        <Text className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
          Próximo turno hoy
        </Text>
        <View className="bg-info/10 rounded-full px-3 py-1">
          <Text className="text-info text-xs font-semibold">Confirmado</Text>
        </View>
      </View>
      <Text className="text-foreground text-lg font-bold" numberOfLines={1}>
        {turno.oferta_titulo}
      </Text>
      <Text className="text-muted-foreground text-sm">
        {fmtTime(turno.hora_inicio)}
        {turno.hora_fin_estimada ? ` – ${fmtTime(turno.hora_fin_estimada)}` : ''}
        {turno.lugar ? `  ·  ${turno.lugar}` : ''}
      </Text>
      <Text className="text-primary text-xs font-semibold mt-1">Ver detalle →</Text>
    </Pressable>
  );
}

/** Estado vacío — sin turno activo hoy */
function NoShiftCard() {
  return (
    <View className="mx-4 mt-4 bg-card rounded-2xl p-5 border border-border items-center gap-2">
      <Text className="text-3xl">📭</Text>
      <Text className="text-base font-semibold text-foreground">Sin turno activo hoy</Text>
      <Text className="text-sm text-muted-foreground text-center">
        No tienes turnos programados para hoy.
      </Text>
    </View>
  );
}

/** Stat card individual */
function StatCard({
  value,
  label,
  color = 'text-primary',
}: {
  value: string | number;
  label: string;
  color?: string;
}) {
  return (
    <View className="flex-1 bg-card rounded-2xl p-4 gap-1 border border-border">
      <Text className={`text-2xl font-extrabold ${color}`}>{value}</Text>
      <Text className="text-xs text-muted-foreground">{label}</Text>
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────

export default function DashboardScreen() {
  const router  = useRouter();
  const usuario = useAuthStore((s) => s.usuario);
  const logout  = useAuthStore((s) => s.logout);

  const isWorker  = WORKER_ROLES.includes(usuario?.rol ?? '');
  const isManager = MANAGE_ROLES.includes(usuario?.rol ?? '');
  const isAdmin   = usuario?.rol === 'admin_empresa';

  // ── Greeting ────────────────────────────────────────────────────────────
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? t('dashboard.greeting')
    : hour < 20 ? t('dashboard.greetingEvening')
    : t('dashboard.greetingNight');

  // ── Data fetching ────────────────────────────────────────────────────────

  const {
    data: turnos = [],
    isLoading: turnosLoading,
    refetch: refetchTurnos,
  } = useMisTurnos();

  const {
    data: equipoData,
    refetch: refetchEquipo,
  } = useTrabajadores({ activo: true, enabled: isManager });
  // Only use equipo data for managers
  const totalEquipo = isManager ? (equipoData?.pagination?.total ?? null) : null;

  const {
    data: periodosData,
    refetch: refetchPeriodos,
  } = usePeriodos('abierto');
  const periodoAbierto = periodosData?.data?.[0] ?? null;

  // ── Pull to refresh ──────────────────────────────────────────────────────

  const [refreshing, setRefreshing] = useState(false);
  async function onRefresh() {
    setRefreshing(true);
    await Promise.all([refetchTurnos(), refetchEquipo(), refetchPeriodos()]);
    setRefreshing(false);
  }

  // ── Derive shift data ────────────────────────────────────────────────────

  const today = toISODate(new Date());

  const turnoActivo = turnos.find((a) => a.estado === 'en_progreso') ?? null;

  const proximoHoy = !turnoActivo
    ? (turnos
        .filter((a) => a.oferta_fecha === today && a.estado === 'confirmado')
        .sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio))[0] ?? null)
    : null;

  // Turnos de hoy (cualquier estado no-cancelado)
  const turnosHoy = turnos.filter(
    (a) =>
      a.oferta_fecha === today &&
      a.estado !== 'cancelado' &&
      a.estado !== 'no_presentado',
  );

  // Próximos 7 días (sin hoy)
  const proximos = turnos
    .filter(
      (a) =>
        a.oferta_fecha > today &&
        (a.estado === 'confirmado' || a.estado === 'pendiente'),
    )
    .sort((a, b) => a.oferta_fecha.localeCompare(b.oferta_fecha))
    .slice(0, 3);

  // ── Stats ────────────────────────────────────────────────────────────────

  const stats: { value: string | number; label: string; color: string }[] = isWorker
    ? [
        {
          value: turnosHoy.length,
          label: 'Turnos hoy',
          color: 'text-primary',
        },
        {
          value: proximos.length,
          label: 'Próximos',
          color: 'text-info',
        },
        {
          value: turnos.filter((a) => a.estado === 'completado').length,
          label: 'Completados',
          color: 'text-success',
        },
      ]
    : [
        {
          value: totalEquipo ?? '…',
          label: t('dashboard.statEmployees'),
          color: 'text-primary',
        },
        {
          value: turnosHoy.length > 0 ? turnosHoy.length : '—',
          label: t('dashboard.statShiftsToday'),
          color: 'text-info',
        },
        {
          value: periodoAbierto ? '1' : '0',
          label: 'Período abierto',
          color: periodoAbierto ? 'text-success' : 'text-muted-foreground',
        },
      ];

  // ── Quick actions ────────────────────────────────────────────────────────

  type Action = { icon: string; label: string; onPress: () => void };

  const actions: Action[] = isWorker
    ? [
        { icon: '📅', label: 'Mis Turnos', onPress: () => router.push('/(tabs)/turnos') },
        { icon: '💰', label: 'Mi Nómina',  onPress: () => router.push('/(tabs)/nomina') },
      ]
    : [
        { icon: '📅', label: 'Turnos',     onPress: () => router.push('/(tabs)/turnos') },
        { icon: '💰', label: 'Nómina',     onPress: () => router.push('/(tabs)/nomina') },
        { icon: '👥', label: 'Equipo',     onPress: () => router.push('/(tabs)/equipo') },
        ...(isAdmin
          ? [{ icon: '➕', label: 'Agregar emp.', onPress: () => router.push('/trabajador/nuevo') }]
          : []),
      ];

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
            tintColor="#FF5A3C"
            colors={['#FF5A3C']}
          />
        }
      >
        {/* ── Header ──────────────────────────────────────────────────── */}
        <View
          className="pt-4 pb-8 px-6 rounded-b-[32px] gap-1"
          style={{ backgroundColor: '#FF5A3C' }}
        >
          <Text className="text-white/80 text-sm font-medium">{greeting} 👋</Text>
          <View className="flex-row items-center justify-between">
            <Text className="text-white text-2xl font-bold">
              {usuario?.nombre ?? '…'}
            </Text>
            <View className="w-10 h-10 rounded-xl bg-white/20 items-center justify-center">
              <Text className="text-lg">🔔</Text>
            </View>
          </View>
          <Text className="text-white/60 text-xs capitalize">
            {usuario?.rol?.replace(/_/g, ' ')}
          </Text>
        </View>

        {/* ── Hero: turno activo / próximo / vacío (solo workers) ─────── */}
        {isWorker && (
          turnoActivo ? (
            <ActiveShiftCard
              turno={turnoActivo}
              onPress={() => router.push(`/turno/${turnoActivo.id}`)}
            />
          ) : proximoHoy ? (
            <NextShiftCard
              turno={proximoHoy}
              onPress={() => router.push(`/turno/${proximoHoy.id}`)}
            />
          ) : (
            <NoShiftCard />
          )
        )}

        {/* ── Período abierto banner (managers) ───────────────────────── */}
        {isManager && periodoAbierto && (
          <Pressable
            onPress={() => router.push('/(tabs)/nomina')}
            className="mx-4 mt-4 flex-row items-center gap-3 bg-success/10 border border-success/30 rounded-2xl px-4 py-3 active:opacity-80"
          >
            <Text className="text-xl">📂</Text>
            <View className="flex-1">
              <Text className="text-success text-sm font-semibold">Período abierto</Text>
              <Text className="text-success/80 text-xs">
                {new Date(periodoAbierto.fecha_inicio).toLocaleDateString('es-CO', {
                  day: 'numeric', month: 'short',
                })}
                {' – '}
                {new Date(periodoAbierto.fecha_fin).toLocaleDateString('es-CO', {
                  day: 'numeric', month: 'short',
                })}
                {'  ·  Toca para gestionar →'}
              </Text>
            </View>
          </Pressable>
        )}

        {/* ── Stat cards ───────────────────────────────────────────────── */}
        <View className="flex-row px-4 mt-4 gap-3">
          {stats.map((s) => (
            <StatCard key={s.label} value={s.value} label={s.label} color={s.color} />
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
                <View className="w-10 h-10 bg-primary/10 rounded-xl items-center justify-center">
                  <Text className="text-xl">{a.icon}</Text>
                </View>
                <Text className="text-[10px] font-semibold text-foreground text-center">
                  {a.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* ── Próximos turnos (workers) ────────────────────────────────── */}
        {isWorker && proximos.length > 0 && (
          <View className="px-4 mt-5 gap-3">
            <View className="flex-row items-center justify-between">
              <Text className="text-base font-semibold text-foreground">
                {t('dashboard.upcomingShifts')}
              </Text>
              <Pressable onPress={() => router.push('/(tabs)/turnos')}>
                <Text className="text-sm text-primary font-semibold">
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
                  {/* Accent dot */}
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

        {/* ── Logout (shortcut de dev) ─────────────────────────────────── */}
        <Pressable
          onPress={logout}
          className="mx-4 mt-8 h-11 rounded-xl items-center justify-center border border-border active:opacity-70"
        >
          <Text className="text-sm text-muted-foreground">Cerrar sesión</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
