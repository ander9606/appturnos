/**
 * Dashboard del super_admin.
 * Muestra las métricas globales del sistema en tiempo real.
 */
import React from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { useAuthStore } from '@/features/auth/useAuthStore';
import { useReportesGlobales } from '@/features/admin/useAdmin';
import { formatCOP } from '@/lib/formatters';

// ── Sub-components ────────────────────────────────────────────────────────

function MetricCard({
  icon,
  value,
  label,
  sub,
  accent = '#6366F1',
}: {
  icon: string;
  value: string | number;
  label: string;
  sub?: string;
  accent?: string;
}) {
  return (
    <View
      className="flex-1 bg-card rounded-2xl p-4 gap-1 border border-border"
      style={{ minWidth: '45%' }}
    >
      <Text className="text-2xl">{icon}</Text>
      <Text className="text-2xl font-extrabold text-foreground">{value}</Text>
      <Text className="text-xs font-semibold text-foreground">{label}</Text>
      {sub ? <Text className="text-xs text-muted-foreground">{sub}</Text> : null}
    </View>
  );
}

function SectionTitle({ title }: { title: string }) {
  return (
    <Text className="text-base font-bold text-foreground px-4 mt-6 mb-2">{title}</Text>
  );
}

const PLAN_LABELS: Record<string, string> = {
  basico: 'Básico',
  profesional: 'Profesional',
  empresarial: 'Empresarial',
};

const PLAN_COLORS: Record<string, string> = {
  basico: '#94A3B8',
  profesional: '#3B82F6',
  empresarial: '#8B5CF6',
};

// ── Screen ────────────────────────────────────────────────────────────────

export default function AdminDashboard() {
  const router  = useRouter();
  const logout  = useAuthStore((s) => s.logout);
  const usuario = useAuthStore((s) => s.usuario);
  const isSuperAdmin = useAuthStore((s) => s.usuario?.rol === 'super_admin');

  const { data, isLoading, isError, refetch } = useReportesGlobales(isSuperAdmin);
  const [refreshing, setRefreshing] = React.useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  // ── Greeting ──────────────────────────────────────────────────────────────
  const hour = new Date().getHours();
  const saludo =
    hour < 12 ? 'Buenos días' : hour < 20 ? 'Buenas tardes' : 'Buenas noches';

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#6366F1"
            colors={['#6366F1']}
          />
        }
      >
        {/* ── Header ──────────────────────────────────────────────────── */}
        <View
          className="pt-4 pb-8 px-6 rounded-b-[32px] gap-1"
          style={{ backgroundColor: '#6366F1' }}
        >
          <Text className="text-white/80 text-sm font-medium">{saludo} 👋</Text>
          <View className="flex-row items-center justify-between">
            <Text className="text-white text-2xl font-bold">
              {usuario?.nombre ?? 'Super Admin'}
            </Text>
            <View className="bg-white/20 rounded-xl px-3 py-1">
              <Text className="text-white text-xs font-bold">⚙️ SISTEMA</Text>
            </View>
          </View>
          <Text className="text-white/60 text-xs">Panel de administración global</Text>
        </View>

        {/* ── Loading / Error ───────────────────────────────────────── */}
        {isLoading && (
          <View className="items-center justify-center py-16">
            <ActivityIndicator size="large" color="#6366F1" />
            <Text className="text-muted-foreground mt-3 text-sm">Cargando métricas…</Text>
          </View>
        )}

        {isError && (
          <View className="mx-4 mt-6 bg-danger/10 border border-danger/30 rounded-2xl p-4 items-center gap-2">
            <Text className="text-2xl">⚠️</Text>
            <Text className="text-danger font-semibold">Error al cargar métricas</Text>
            <Pressable onPress={() => refetch()} className="mt-1">
              <Text className="text-primary text-sm font-semibold">Reintentar</Text>
            </Pressable>
          </View>
        )}

        {data && (
          <>
            {/* ── Empresas ─────────────────────────────────────────── */}
            <SectionTitle title="Empresas" />
            <View className="flex-row flex-wrap px-4 gap-3">
              <MetricCard
                icon="🏢"
                value={data.empresas.total}
                label="Total empresas"
                sub={`${data.empresas.activas} activas · ${data.empresas.inactivas} inactivas`}
              />
              <MetricCard
                icon="👥"
                value={data.trabajadores.total}
                label="Trabajadores"
                sub={`${data.trabajadores.activos} activos`}
              />
            </View>

            {/* ── Usuarios y turnos ────────────────────────────────── */}
            <SectionTitle title="Actividad" />
            <View className="flex-row flex-wrap px-4 gap-3">
              <MetricCard
                icon="🔑"
                value={data.usuarios.total}
                label="Usuarios con acceso"
              />
              <MetricCard
                icon="📅"
                value={data.turnos.ultimo_mes}
                label="Turnos (últimos 30 días)"
              />
            </View>

            {/* ── Ingresos ─────────────────────────────────────────── */}
            <SectionTitle title="Ingresos" />
            <View className="flex-row flex-wrap px-4 gap-3">
              <MetricCard
                icon="📈"
                value={formatCOP(data.ingresos?.proyeccion_mes_actual)}
                label="Proyección este mes"
                sub={`${data.integraciones.pago_directo} empresa${data.integraciones.pago_directo === 1 ? '' : 's'} pagando`}
                accent="#22C55E"
              />
              <MetricCard
                icon="💰"
                value={formatCOP(data.ingresos?.ganado_mes_pasado)}
                label="Ganado el mes pasado"
                sub="Pagos Wompi procesados"
                accent="#22C55E"
              />
            </View>

            {/* ── Integraciones ────────────────────────────────────── */}
            <SectionTitle title="Integraciones" />
            <View className="flex-row flex-wrap px-4 gap-3">
              <MetricCard
                icon="🔗"
                value={data.integraciones.logiq360}
                label="Usan logiq360"
                sub="No pagan suscripción"
              />
              <MetricCard
                icon="💳"
                value={data.integraciones.pago_directo}
                label="Pagan directo a Zaturno"
                sub={`Tarifa: ${formatCOP(data.ingresos?.tarifa_cop)}/mes`}
              />
            </View>

            {/* ── Nómina ───────────────────────────────────────────── */}
            <SectionTitle title="Nómina" />
            <View className="px-4">
              <View
                className={[
                  'rounded-2xl px-4 py-3 flex-row items-center gap-3',
                  data.nomina.periodos_abiertos > 0
                    ? 'bg-success/10 border border-success/30'
                    : 'bg-card border border-border',
                ].join(' ')}
              >
                <Text className="text-2xl">
                  {data.nomina.periodos_abiertos > 0 ? '📂' : '📁'}
                </Text>
                <View>
                  <Text
                    className={
                      data.nomina.periodos_abiertos > 0
                        ? 'text-success font-semibold'
                        : 'text-muted-foreground font-semibold'
                    }
                  >
                    {data.nomina.periodos_abiertos}{' '}
                    {data.nomina.periodos_abiertos === 1
                      ? 'período abierto'
                      : 'períodos abiertos'}
                  </Text>
                  <Text className="text-xs text-muted-foreground">
                    En todos los tenants
                  </Text>
                </View>
              </View>
            </View>

            {/* ── Distribución de planes ───────────────────────────── */}
            {Object.keys(data.distribucion_planes).length > 0 && (
              <>
                <SectionTitle title="Distribución por plan" />
                <View className="px-4 gap-2">
                  {Object.entries(data.distribucion_planes).map(([plan, total]) => (
                    <View
                      key={plan}
                      className="bg-card border border-border rounded-xl px-4 py-3 flex-row items-center justify-between"
                    >
                      <View className="flex-row items-center gap-2">
                        <View
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: PLAN_COLORS[plan] ?? '#94A3B8' }}
                        />
                        <Text className="text-sm font-medium text-foreground">
                          {PLAN_LABELS[plan] ?? plan}
                        </Text>
                      </View>
                      <Text className="text-sm font-bold text-foreground">{total}</Text>
                    </View>
                  ))}
                </View>
              </>
            )}
          </>
        )}

        {/* ── Acciones rápidas ──────────────────────────────────────── */}
        <SectionTitle title="Acciones rápidas" />
        <View className="flex-row flex-wrap px-4 gap-3">
          <Pressable
            onPress={() => router.push('/(admin)/empresas')}
            className="bg-card border border-border rounded-2xl p-4 items-center gap-2 active:opacity-70"
            style={{ width: '47%' }}
          >
            <View className="w-10 h-10 rounded-xl items-center justify-center"
              style={{ backgroundColor: '#6366F110' }}>
              <Text className="text-xl">🏢</Text>
            </View>
            <Text className="text-xs font-semibold text-foreground text-center">
              Gestionar empresas
            </Text>
          </Pressable>

          <Pressable
            onPress={() => router.push('/(admin)/reportes')}
            className="bg-card border border-border rounded-2xl p-4 items-center gap-2 active:opacity-70"
            style={{ width: '47%' }}
          >
            <View className="w-10 h-10 rounded-xl items-center justify-center"
              style={{ backgroundColor: '#6366F110' }}>
              <Text className="text-xl">📈</Text>
            </View>
            <Text className="text-xs font-semibold text-foreground text-center">
              Ver reportes
            </Text>
          </Pressable>

          <Pressable
            onPress={() => router.push('/(admin)/pagos' as any)}
            className="bg-card border border-border rounded-2xl p-4 items-center gap-2 active:opacity-70"
            style={{ width: '47%' }}
          >
            <View className="w-10 h-10 rounded-xl items-center justify-center"
              style={{ backgroundColor: '#6366F110' }}>
              <Text className="text-xl">💳</Text>
            </View>
            <Text className="text-xs font-semibold text-foreground text-center">
              Ver pagos Wompi
            </Text>
          </Pressable>
        </View>

        {/* ── Cerrar sesión ──────────────────────────────────────────── */}
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
