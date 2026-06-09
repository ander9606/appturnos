/**
 * Solicitudes de vinculación — pantalla del administrador
 *
 * Muestra la lista de solicitudes de vinculación pendientes:
 *  - Solicitadas por el trabajador (trabajador quiere unirse a la empresa)
 *  - Invitaciones enviadas por la empresa (pendientes de que el trabajador acepte)
 *
 * Acciones disponibles: Aprobar / Rechazar
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  TextInput,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import {
  useSolicitudes,
  useAprobar,
  useRechazarVinculo,
} from '@/features/empresas/useTrabajadorEmpresa';
import type { SolicitudAdmin } from '@api-client';

// ── Helpers ───────────────────────────────────────────────────────────────

function fmtFecha(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });
}

function getInitials(nombre?: string, apellido?: string): string {
  return ((nombre?.[0] ?? '') + (apellido?.[0] ?? '')).toUpperCase() || '?';
}

// ── Sub-components ─────────────────────────────────────────────────────────

type TabEstado = 'pendientes' | 'aprobadas';

function TabBar({
  active,
  onChange,
  counts,
}: {
  active: TabEstado;
  onChange: (t: TabEstado) => void;
  counts: { pendientes: number; aprobadas: number };
}) {
  const tabs: { key: TabEstado; label: string }[] = [
    { key: 'pendientes', label: 'Pendientes' },
    { key: 'aprobadas',  label: 'Aprobadas' },
  ];

  return (
    <View className="flex-row gap-2 px-5 mb-4">
      {tabs.map(({ key, label }) => {
        const isActive = active === key;
        const count = counts[key];
        return (
          <Pressable
            key={key}
            onPress={() => onChange(key)}
            className={`flex-row items-center gap-1.5 rounded-full px-4 py-2 border ${
              isActive ? 'bg-primary-500 border-primary-500' : 'bg-card border-border'
            }`}
          >
            <Text className={`text-sm font-semibold ${isActive ? 'text-white' : 'text-muted-foreground'}`}>
              {label}
            </Text>
            {count > 0 && (
              <View className={`rounded-full min-w-[18px] h-[18px] items-center justify-center px-1 ${
                isActive ? 'bg-white/30' : 'bg-primary-500'
              }`}>
                <Text className={`text-xs font-bold ${isActive ? 'text-white' : 'text-white'}`}>{count}</Text>
              </View>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

function SolicitudCard({
  solicitud,
  onAprobar,
  onRechazar,
  loadingId,
}: {
  solicitud: SolicitudAdmin;
  onAprobar: (id: number) => void;
  onRechazar: (id: number) => void;
  loadingId: number | null;
}) {
  const isPending = solicitud.estado === 'solicitado_por_trabajador' || solicitud.estado === 'solicitado_por_empresa';
  const isActivo  = solicitud.estado === 'activo';
  const loading   = loadingId === solicitud.id;

  const estadoConfig: Record<string, { label: string; color: string; bg: string }> = {
    solicitado_por_trabajador: { label: 'Solicita unirse',    color: '#D97706', bg: '#FEF3C7' },
    solicitado_por_empresa:    { label: 'Invitación enviada', color: '#3B82F6', bg: '#EFF6FF' },
    activo:                    { label: 'Activo',             color: '#059669', bg: '#D1FAE5' },
    rechazado:                 { label: 'Rechazado',          color: '#EF4444', bg: '#FEE2E2' },
    archivado:                 { label: 'Archivado',          color: '#94A3B8', bg: '#F1F5F9' },
  };

  const cfg = estadoConfig[solicitud.estado] ?? estadoConfig.archivado;

  return (
    <View className="mx-5 mb-3 bg-card rounded-2xl border border-border overflow-hidden">
      <View className="flex-row items-center gap-3 px-4 pt-4 pb-3">
        {/* Avatar */}
        <View className="w-11 h-11 rounded-full bg-primary-50 items-center justify-center">
          <Text className="text-sm font-bold text-primary-500">
            {getInitials(solicitud.usuario_nombre ?? undefined, solicitud.usuario_apellido ?? undefined)}
          </Text>
        </View>

        {/* Info */}
        <View className="flex-1">
          <Text className="text-base font-semibold text-foreground">
            {solicitud.usuario_nombre} {solicitud.usuario_apellido}
          </Text>
          <Text className="text-xs text-muted-foreground mt-0.5">{solicitud.usuario_email}</Text>
          <Text className="text-xs text-muted-foreground mt-0.5">
            {fmtFecha(solicitud.fecha_solicitud)}
          </Text>
        </View>

        {/* Estado badge */}
        <View className="rounded-full px-2.5 py-1" style={{ backgroundColor: cfg.bg }}>
          <Text className="text-xs font-semibold" style={{ color: cfg.color }}>{cfg.label}</Text>
        </View>
      </View>

      {/* Acciones — solo para pendientes */}
      {isPending && (
        <View className="flex-row gap-2 px-4 pb-4">
          <TouchableOpacity
            onPress={() => onRechazar(solicitud.id)}
            disabled={loading}
            className="flex-1 h-10 rounded-xl border border-border items-center justify-center active:opacity-70"
          >
            <Text className="text-sm font-semibold text-muted-foreground">Rechazar</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => onAprobar(solicitud.id)}
            disabled={loading}
            className="flex-1 h-10 rounded-xl bg-primary-500 items-center justify-center active:opacity-80"
          >
            {loading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text className="text-sm font-semibold text-white">Aprobar</Text>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

// ── Screen ─────────────────────────────────────────────────────────────────

export default function SolicitudesScreen() {
  const [tab, setTab] = useState<TabEstado>('pendientes');
  const [search, setSearch] = useState('');
  const [loadingId, setLoadingId] = useState<number | null>(null);

  // undefined → backend default = IN ('solicitado_por_trabajador', 'solicitado_por_empresa')
  // 'activo'  → vínculo ya aprobado
  const estadoFiltro = tab === 'aprobadas' ? 'activo' : undefined;
  const { data = [], isLoading, refetch } = useSolicitudes(estadoFiltro);

  const aprobar  = useAprobar();
  const rechazar = useRechazarVinculo();

  const term = search.trim().toLowerCase();
  const solicitudes = data.filter((s) => {
    if (!term) return true;
    return (
      s.usuario_nombre?.toLowerCase().includes(term) ||
      s.usuario_apellido?.toLowerCase().includes(term) ||
      s.usuario_email?.toLowerCase().includes(term)
    );
  });

  const pendientesCount = tab === 'pendientes' ? solicitudes.length : 0;
  const aprobadosCount  = tab === 'aprobadas'  ? solicitudes.length : 0;

  const handleAprobar = async (id: number) => {
    setLoadingId(id);
    try {
      await aprobar.mutateAsync(id);
    } catch {
      Alert.alert('Error', 'No se pudo aprobar la solicitud');
    } finally {
      setLoadingId(null);
    }
  };

  const handleRechazar = (id: number) => {
    Alert.alert(
      'Rechazar solicitud',
      '¿Estás seguro de que deseas rechazar esta solicitud?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Rechazar',
          style: 'destructive',
          onPress: async () => {
            setLoadingId(id);
            try {
              await rechazar.mutateAsync({ id });
            } catch {
              Alert.alert('Error', 'No se pudo rechazar la solicitud');
            } finally {
              setLoadingId(null);
            }
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['bottom']}>
      <Stack.Screen
        options={{
          title: 'Solicitudes de vinculación',
          headerShown: true,
        }}
      />

      <ScrollView
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} />}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingVertical: 16, paddingBottom: 40 }}
      >
        {/* Search */}
        <View className="px-5 mb-4">
          <View className="flex-row items-center bg-card border border-border rounded-xl px-3 h-10 gap-2">
            <Ionicons name="search-outline" size={16} color="#64748B" />
            <TextInput
              className="flex-1 text-sm text-foreground"
              placeholder="Buscar por nombre o email…"
              placeholderTextColor="#94A3B8"
              value={search}
              onChangeText={setSearch}
              autoCorrect={false}
            />
            {search.length > 0 && (
              <Pressable onPress={() => setSearch('')} hitSlop={8}>
                <Ionicons name="close-circle" size={16} color="#94A3B8" />
              </Pressable>
            )}
          </View>
        </View>

        {/* Tabs */}
        <TabBar
          active={tab}
          onChange={setTab}
          counts={{ pendientes: pendientesCount, aprobadas: aprobadosCount }}
        />

        {/* Empty state */}
        {!isLoading && solicitudes.length === 0 && (
          <View className="items-center justify-center px-8 py-16 gap-3">
            <View className="w-16 h-16 rounded-2xl bg-muted items-center justify-center">
              <Ionicons name="people-outline" size={32} color="#94A3B8" />
            </View>
            <Text className="text-lg font-bold text-foreground text-center">
              {tab === 'pendientes' ? 'Sin solicitudes pendientes' : 'Sin vínculos aprobados'}
            </Text>
            <Text className="text-sm text-muted-foreground text-center">
              {tab === 'pendientes'
                ? 'No hay solicitudes de vinculación que requieran tu atención.'
                : 'Ningún trabajador tiene vínculo activo con esta empresa aún.'}
            </Text>
          </View>
        )}

        {/* List */}
        {solicitudes.map((s) => (
          <SolicitudCard
            key={s.id}
            solicitud={s}
            onAprobar={handleAprobar}
            onRechazar={handleRechazar}
            loadingId={loadingId}
          />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
