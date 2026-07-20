/**
 * Lista de todas las empresas — panel super_admin.
 * Permite buscar, filtrar por plan/estado y navegar al detalle.
 */
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { useAuthStore } from '@/features/auth/useAuthStore';
import { useAdminEmpresas } from '@/features/admin/useAdmin';
import type { PlanEmpresa } from '@api-client';

// ── Constants ─────────────────────────────────────────────────────────────

const PLAN_LABELS: Record<PlanEmpresa, string> = {
  basico: 'Básico',
  profesional: 'Pro',
  empresarial: 'Emp.',
};

const PLAN_COLORS: Record<PlanEmpresa, string> = {
  basico: '#94A3B8',
  profesional: '#3B82F6',
  empresarial: '#8B5CF6',
};

// ── Sub-components ────────────────────────────────────────────────────────

function FilterChip({
  label,
  active,
  onPress,
  color,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  color?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={[
        'px-3 py-1.5 rounded-full border',
        active ? 'border-transparent' : 'border-border bg-card',
      ].join(' ')}
      style={active ? { backgroundColor: color ?? '#6366F1' } : {}}
    >
      <Text
        className="text-xs font-semibold"
        style={{ color: active ? '#FFFFFF' : '#64748B' }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────

type FiltroEstado = 'todas' | 'activas' | 'inactivas';
type FiltroPlan = 'todas' | PlanEmpresa;

export default function EmpresasScreen() {
  const router = useRouter();

  const [busqueda, setBusqueda] = useState('');
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstado>('todas');
  const [filtroPlan, setFiltroPlan] = useState<FiltroPlan>('todas');
  const [refreshing, setRefreshing] = useState(false);

  const params = {
    busqueda: busqueda.trim() || undefined,
    activo:
      filtroEstado === 'activas' ? true
      : filtroEstado === 'inactivas' ? false
      : undefined,
    plan: filtroPlan !== 'todas' ? filtroPlan : undefined,
    limit: 50,
  };

  const isSuperAdmin = useAuthStore((s) => s.usuario?.rol === 'super_admin');
  const { data, isLoading, isError, refetch } = useAdminEmpresas(params, isSuperAdmin);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const empresas = data?.data ?? [];

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      {/* ── Header ──────────────────────────────────────────────────── */}
      <View
        className="px-4 pt-4 pb-5"
        style={{ backgroundColor: '#6366F1' }}
      >
        <Text className="text-white text-2xl font-bold mb-3">🏢 Empresas</Text>

        {/* Search */}
        <View className="bg-white/20 rounded-xl flex-row items-center px-3 gap-2 h-10">
          <Text className="text-white/70">🔍</Text>
          <TextInput
            className="flex-1 text-white text-sm"
            placeholder="Buscar por nombre, slug o NIT…"
            placeholderTextColor="rgba(255,255,255,0.5)"
            value={busqueda}
            onChangeText={setBusqueda}
            returnKeyType="search"
            autoCapitalize="none"
          />
          {busqueda.length > 0 && (
            <Pressable onPress={() => setBusqueda('')}>
              <Text className="text-white/70 text-base">✕</Text>
            </Pressable>
          )}
        </View>
      </View>

      {/* ── Filters ──────────────────────────────────────────────────── */}
      <View className="px-4 py-3 gap-2 border-b border-border">
        {/* Estado */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View className="flex-row gap-2">
            {(['todas', 'activas', 'inactivas'] as FiltroEstado[]).map((f) => (
              <FilterChip
                key={f}
                label={f.charAt(0).toUpperCase() + f.slice(1)}
                active={filtroEstado === f}
                onPress={() => setFiltroEstado(f)}
                color={f === 'activas' ? '#22C55E' : f === 'inactivas' ? '#EF4444' : '#6366F1'}
              />
            ))}
          </View>
        </ScrollView>

        {/* Plan */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View className="flex-row gap-2">
            {(['todas', 'basico', 'profesional', 'empresarial'] as FiltroPlan[]).map((p) => (
              <FilterChip
                key={p}
                label={p === 'todas' ? 'Todos los planes' : PLAN_LABELS[p as PlanEmpresa]}
                active={filtroPlan === p}
                onPress={() => setFiltroPlan(p)}
                color={p !== 'todas' ? PLAN_COLORS[p as PlanEmpresa] : '#6366F1'}
              />
            ))}
          </View>
        </ScrollView>
      </View>

      {/* ── List ─────────────────────────────────────────────────────── */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 32, paddingTop: 8 }}
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
            <Text className="text-muted-foreground mt-3 text-sm">Cargando empresas…</Text>
          </View>
        )}

        {isError && (
          <View className="mx-4 mt-4 bg-danger/10 border border-danger/30 rounded-2xl p-4 items-center gap-2">
            <Text className="text-2xl">⚠️</Text>
            <Text className="text-danger font-semibold">Error al cargar empresas</Text>
            <Pressable onPress={() => refetch()}>
              <Text className="text-primary text-sm font-semibold">Reintentar</Text>
            </Pressable>
          </View>
        )}

        {!isLoading && !isError && empresas.length === 0 && (
          <View className="items-center py-16 gap-2">
            <Text className="text-4xl">🏙️</Text>
            <Text className="text-foreground font-semibold text-base">Sin resultados</Text>
            <Text className="text-muted-foreground text-sm text-center px-8">
              No se encontraron empresas con los filtros actuales.
            </Text>
          </View>
        )}

        {empresas.map((empresa) => {
          const planColor = PLAN_COLORS[empresa.plan] ?? '#94A3B8';
          const isActiva = empresa.activo === 1;

          return (
            <Pressable
              key={empresa.id}
              onPress={() => router.push(`/(admin)/empresa/${empresa.id}`)}
              className="mx-4 mb-3 bg-card border border-border rounded-2xl p-4 gap-3 active:opacity-80"
            >
              <View className="flex-row items-start justify-between gap-3">
                {/* Info principal */}
                <View className="flex-1 gap-1">
                  <View className="flex-row items-center gap-2 flex-wrap">
                    <Text className="text-base font-bold text-foreground" numberOfLines={1}>
                      {empresa.nombre}
                    </Text>
                    {/* Estado badge */}
                    <View
                      className="rounded-full px-2 py-0.5"
                      style={{
                        backgroundColor: isActiva ? '#22C55E20' : '#EF444420',
                      }}
                    >
                      <Text
                        className="text-[10px] font-bold"
                        style={{ color: isActiva ? '#16A34A' : '#DC2626' }}
                      >
                        {isActiva ? 'ACTIVA' : 'INACTIVA'}
                      </Text>
                    </View>
                  </View>

                  <Text className="text-xs text-muted-foreground">
                    {empresa.slug}
                    {empresa.ciudad ? ` · ${empresa.ciudad}` : ''}
                    {empresa.nit ? ` · NIT ${empresa.nit}` : ''}
                  </Text>
                </View>

                {/* Plan badge */}
                <View
                  className="rounded-lg px-2.5 py-1"
                  style={{ backgroundColor: planColor + '20' }}
                >
                  <Text className="text-xs font-bold" style={{ color: planColor }}>
                    {PLAN_LABELS[empresa.plan]}
                  </Text>
                </View>
              </View>

              {/* Stats row */}
              <View className="flex-row gap-4 pt-1 border-t border-border">
                <View className="flex-row items-center gap-1">
                  <Text className="text-xs text-muted-foreground">👷</Text>
                  <Text className="text-xs text-muted-foreground">
                    {empresa.total_trabajadores} trabajadores
                  </Text>
                </View>
                <View className="flex-row items-center gap-1">
                  <Text className="text-xs text-muted-foreground">🔑</Text>
                  <Text className="text-xs text-muted-foreground">
                    {empresa.total_usuarios} usuarios
                  </Text>
                </View>
                <Text className="text-xs text-muted-foreground ml-auto">Ver →</Text>
              </View>
            </Pressable>
          );
        })}

        {/* Paginación simple */}
        {data && data.pagination.total > empresas.length && (
          <Text className="text-center text-xs text-muted-foreground mt-2">
            Mostrando {empresas.length} de {data.pagination.total}
          </Text>
        )}
      </ScrollView>

      {/* ── FAB: Nueva empresa ────────────────────────────────────────── */}
      <Pressable
        onPress={() => router.push('/(admin)/empresa/nueva')}
        className="absolute bottom-8 right-6 w-14 h-14 rounded-full items-center justify-center shadow-lg active:opacity-80"
        style={{ backgroundColor: '#6366F1' }}
      >
        <Text className="text-white text-2xl font-bold">+</Text>
      </Pressable>
    </SafeAreaView>
  );
}
