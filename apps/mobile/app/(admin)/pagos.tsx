/**
 * Pagos Wompi — panel super_admin.
 * Lista los eventos de pago recibidos vía webhook, con filtro por estado
 * y reintento manual para los que quedaron en error.
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { useAuthStore } from '@/features/auth/useAuthStore';
import { useWompiEventos, useReintentarWompiEvento, useReportesGlobales } from '@/features/admin/useAdmin';
import { formatCOP } from '@/lib/formatters';
import { confirm } from '@/lib/confirmDialog';
import type { WompiEstado, WompiEvento } from '@api-client';

// ── Constants ─────────────────────────────────────────────────────────────

const ESTADOS: { value: WompiEstado | 'todos'; label: string; color: string }[] = [
  { value: 'todos',     label: 'Todos',     color: '#6366F1' },
  { value: 'procesado', label: 'Procesado', color: '#22C55E' },
  { value: 'error',     label: 'Error',     color: '#EF4444' },
  { value: 'rechazado', label: 'Rechazado', color: '#F59E0B' },
  { value: 'recibido',  label: 'Recibido',  color: '#3B82F6' },
  { value: 'ignorado',  label: 'Ignorado',  color: '#94A3B8' },
];

const ESTADO_COLOR: Record<WompiEstado, string> = {
  procesado: '#22C55E',
  error: '#EF4444',
  rechazado: '#F59E0B',
  recibido: '#3B82F6',
  ignorado: '#94A3B8',
};

function fmtFecha(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-CO', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

// ── Sub-components ────────────────────────────────────────────────────────

function FilterChip({ label, active, onPress, color }: { label: string; active: boolean; onPress: () => void; color: string }) {
  return (
    <Pressable
      onPress={onPress}
      className={['px-3 py-1.5 rounded-full border', active ? 'border-transparent' : 'border-border bg-card'].join(' ')}
      style={active ? { backgroundColor: color } : {}}
    >
      <Text className="text-xs font-semibold" style={{ color: active ? '#FFFFFF' : '#64748B' }}>{label}</Text>
    </Pressable>
  );
}

function EventoCard({ evento, tarifa, onReintentar, reintentando }: {
  evento: WompiEvento;
  tarifa: number;
  onReintentar: (id: number) => void;
  reintentando: boolean;
}) {
  const color = ESTADO_COLOR[evento.estado];
  const monto = evento.meses ? evento.meses * tarifa : null;

  return (
    <View className="mx-4 mb-3 bg-card border border-border rounded-2xl p-4 gap-2">
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1 gap-0.5">
          <Text className="text-sm font-bold text-foreground" numberOfLines={1}>
            {evento.empresa_nombre ?? 'Empresa no identificada'}
          </Text>
          <Text className="text-xs text-muted-foreground" numberOfLines={1}>
            {evento.referencia ?? evento.transaction_id}
          </Text>
        </View>
        <View className="rounded-full px-2 py-0.5" style={{ backgroundColor: color + '20' }}>
          <Text className="text-[10px] font-bold" style={{ color }}>
            {evento.estado.toUpperCase()}
          </Text>
        </View>
      </View>

      <View className="flex-row items-center gap-4 pt-1 border-t border-border">
        {monto != null && (
          <Text className="text-sm font-bold text-foreground">{formatCOP(monto)}</Text>
        )}
        {evento.meses != null && (
          <Text className="text-xs text-muted-foreground">{evento.meses} mes{evento.meses > 1 ? 'es' : ''}</Text>
        )}
        <Text className="text-xs text-muted-foreground ml-auto">
          {fmtFecha(evento.procesado_at ?? evento.created_at)}
        </Text>
      </View>

      {evento.error_detalle && (
        <Text className="text-xs text-danger" numberOfLines={2}>{evento.error_detalle}</Text>
      )}

      {evento.estado === 'error' && (
        <Pressable
          onPress={() => onReintentar(evento.id)}
          disabled={reintentando}
          className="mt-1 h-9 rounded-xl items-center justify-center border border-danger/40 bg-danger/10 active:opacity-70"
        >
          {reintentando ? (
            <ActivityIndicator size="small" color="#EF4444" />
          ) : (
            <Text className="text-xs font-bold text-danger">🔄 Reintentar (intento {evento.intentos})</Text>
          )}
        </Pressable>
      )}
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────

export default function PagosScreen() {
  const router = useRouter();
  const [filtro, setFiltro] = useState<WompiEstado | 'todos'>('todos');
  const [refreshing, setRefreshing] = useState(false);
  const [reintentandoId, setReintentandoId] = useState<number | null>(null);

  const isSuperAdmin = useAuthStore((s) => s.usuario?.rol === 'super_admin');
  const { data: reportes } = useReportesGlobales(isSuperAdmin);
  const tarifa = reportes?.ingresos.tarifa_cop ?? 0;

  const { data, isLoading, isError, refetch } = useWompiEventos({
    estado: filtro !== 'todos' ? filtro : undefined,
    limit: 50,
  }, isSuperAdmin);

  const reintentarMutation = useReintentarWompiEvento();

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const handleReintentar = async (id: number) => {
    const ok = await confirm({
      title: '¿Reintentar pago?',
      message: 'Se volverá a intentar activar la suscripción con este evento.',
      confirmLabel: 'Reintentar',
    });
    if (!ok) return;
    setReintentandoId(id);
    try {
      await reintentarMutation.mutateAsync(id);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al reintentar';
      Alert.alert('Error', msg);
    } finally {
      setReintentandoId(null);
    }
  };

  const eventos = data?.data ?? [];

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      {/* ── Header ──────────────────────────────────────────────────── */}
      <View className="px-4 pt-3 pb-5 flex-row items-center gap-3" style={{ backgroundColor: '#6366F1' }}>
        <Pressable onPress={() => router.back()}>
          <Text className="text-white text-base">←</Text>
        </Pressable>
        <View className="flex-1">
          <Text className="text-white text-lg font-bold">💳 Pagos Wompi</Text>
          <Text className="text-white/70 text-xs">Eventos de pago recibidos por webhook</Text>
        </View>
      </View>

      {/* ── Filtros ──────────────────────────────────────────────────── */}
      <View className="px-4 py-3 border-b border-border">
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View className="flex-row gap-2">
            {ESTADOS.map((e) => (
              <FilterChip
                key={e.value}
                label={e.label}
                active={filtro === e.value}
                onPress={() => setFiltro(e.value)}
                color={e.color}
              />
            ))}
          </View>
        </ScrollView>
      </View>

      {/* ── Lista ────────────────────────────────────────────────────── */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 32, paddingTop: 12 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366F1" colors={['#6366F1']} />}
      >
        {isLoading && (
          <View className="items-center py-16">
            <ActivityIndicator size="large" color="#6366F1" />
            <Text className="text-muted-foreground mt-3 text-sm">Cargando pagos…</Text>
          </View>
        )}

        {isError && (
          <View className="mx-4 mt-4 bg-danger/10 border border-danger/30 rounded-2xl p-4 items-center gap-2">
            <Text className="text-2xl">⚠️</Text>
            <Text className="text-danger font-semibold">Error al cargar pagos</Text>
            <Pressable onPress={() => refetch()}>
              <Text className="text-primary text-sm font-semibold">Reintentar</Text>
            </Pressable>
          </View>
        )}

        {!isLoading && !isError && eventos.length === 0 && (
          <View className="items-center py-16 gap-2">
            <Text className="text-4xl">💳</Text>
            <Text className="text-foreground font-semibold text-base">Sin pagos</Text>
            <Text className="text-muted-foreground text-sm text-center px-8">
              No hay eventos de pago con este filtro.
            </Text>
          </View>
        )}

        {eventos.map((evento) => (
          <EventoCard
            key={evento.id}
            evento={evento}
            tarifa={tarifa}
            onReintentar={handleReintentar}
            reintentando={reintentandoId === evento.id}
          />
        ))}

        {data && data.total > eventos.length && (
          <Text className="text-center text-xs text-muted-foreground mt-2">
            Mostrando {eventos.length} de {data.total}
          </Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
