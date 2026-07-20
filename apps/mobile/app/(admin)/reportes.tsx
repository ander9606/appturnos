/**
 * Tab de Reportes globales — panel super_admin.
 * Muestra estadísticas detalladas del sistema con visualizaciones básicas.
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuthStore } from '@/features/auth/useAuthStore';
import { useReportesGlobales } from '@/features/admin/useAdmin';

// ── Sub-components ────────────────────────────────────────────────────────

function StatRow({
  icon,
  label,
  value,
  sub,
}: {
  icon: string;
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <View className="flex-row items-center gap-3 py-3 border-b border-border last:border-b-0">
      <View className="w-9 h-9 bg-background rounded-xl items-center justify-center">
        <Text className="text-lg">{icon}</Text>
      </View>
      <View className="flex-1">
        <Text className="text-sm font-medium text-foreground">{label}</Text>
        {sub ? <Text className="text-xs text-muted-foreground">{sub}</Text> : null}
      </View>
      <Text className="text-lg font-bold text-foreground">{value}</Text>
    </View>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <View className="mx-4 mb-4 bg-card border border-border rounded-2xl px-4 py-2">
      {children}
    </View>
  );
}

function CardTitle({ title, emoji }: { title: string; emoji: string }) {
  return (
    <View className="flex-row items-center gap-2 py-3 border-b border-border mb-1">
      <Text className="text-xl">{emoji}</Text>
      <Text className="text-base font-bold text-foreground">{title}</Text>
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────

export default function ReportesScreen() {
  const isSuperAdmin = useAuthStore((s) => s.usuario?.rol === 'super_admin');
  const { data, isLoading, isError, refetch } = useReportesGlobales(isSuperAdmin);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      {/* Header */}
      <View className="px-4 pt-4 pb-5" style={{ backgroundColor: '#6366F1' }}>
        <Text className="text-white text-2xl font-bold">📈 Reportes</Text>
        <Text className="text-white/70 text-sm mt-0.5">Métricas globales del sistema</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 32, paddingTop: 16 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#6366F1"
            colors={['#6366F1']}
          />
        }
      >
        {isLoading && (
          <View className="items-center py-16">
            <ActivityIndicator size="large" color="#6366F1" />
            <Text className="text-muted-foreground mt-3 text-sm">Cargando reportes…</Text>
          </View>
        )}

        {isError && (
          <View className="mx-4 bg-danger/10 border border-danger/30 rounded-2xl p-4 items-center gap-2">
            <Text className="text-2xl">⚠️</Text>
            <Text className="text-danger font-semibold">Error al cargar reportes</Text>
            <Pressable onPress={() => refetch()}>
              <Text className="text-primary text-sm font-semibold">Reintentar</Text>
            </Pressable>
          </View>
        )}

        {data && (
          <>
            {/* ── Resumen de empresas ──────────────────────────────── */}
            <Card>
              <CardTitle title="Empresas" emoji="🏢" />
              <StatRow
                icon="🏢"
                label="Total de empresas"
                value={data.empresas.total}
              />
              <StatRow
                icon="✅"
                label="Empresas activas"
                value={data.empresas.activas}
                sub={`${data.empresas.total > 0 ? Math.round((data.empresas.activas / data.empresas.total) * 100) : 0}% del total`}
              />
              <StatRow
                icon="⛔"
                label="Empresas inactivas"
                value={data.empresas.inactivas}
              />
            </Card>

            {/* ── Usuarios y trabajadores ──────────────────────────── */}
            <Card>
              <CardTitle title="Personas" emoji="👥" />
              <StatRow
                icon="🔑"
                label="Usuarios con acceso"
                value={data.usuarios.total}
                sub="Todos los roles excepto super_admin"
              />
              <StatRow
                icon="👷"
                label="Trabajadores totales"
                value={data.trabajadores.total}
              />
              <StatRow
                icon="✅"
                label="Trabajadores activos"
                value={data.trabajadores.activos}
                sub={`${data.trabajadores.total > 0 ? Math.round((data.trabajadores.activos / data.trabajadores.total) * 100) : 0}% del total`}
              />
            </Card>

            {/* ── Actividad ────────────────────────────────────────── */}
            <Card>
              <CardTitle title="Actividad" emoji="📅" />
              <StatRow
                icon="📅"
                label="Turnos (últimos 30 días)"
                value={data.turnos.ultimo_mes}
              />
              <StatRow
                icon="📂"
                label="Períodos de nómina abiertos"
                value={data.nomina.periodos_abiertos}
              />
            </Card>

            {/* ── Última actualización ─────────────────────────────── */}
            <Text className="text-center text-xs text-muted-foreground px-4">
              Datos actualizados al{' '}
              {new Date().toLocaleString('es-CO', {
                day: 'numeric',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Text>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
