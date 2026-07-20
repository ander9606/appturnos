import React from 'react';
import {
  View, Text, FlatList, TouchableOpacity, RefreshControl, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/features/auth/useAuthStore';
import { useTheme } from '@/lib/theme';
import { useAusencias, useActualizarEstadoAusencia } from '@/features/ausencias/useAusencias';
import { Badge } from '@/components/ui/Badge';
import type { Ausencia } from '@api-client';
import { confirm } from '@/lib/confirmDialog';

const TIPO_LABEL: Record<string, string> = {
  vacaciones: 'Vacaciones',
  permiso:    'Permiso',
  incapacidad:'Incapacidad',
  otro:       'Otro',
};

const ESTADO_VARIANT: Record<string, 'warning' | 'success' | 'danger'> = {
  pendiente:  'warning',
  aprobada:   'success',
  rechazada:  'danger',
};

const ESTADO_LABEL: Record<string, string> = {
  pendiente:  'Pendiente',
  aprobada:   'Aprobada',
  rechazada:  'Rechazada',
};

const GESTORES = ['admin_empresa', 'jefe_turnos', 'jefe_nomina'];

export default function AusenciasScreen() {
  const router  = useRouter();
  const theme   = useTheme();
  const rol     = useAuthStore((s) => s.usuario?.rol);
  const isGestor = GESTORES.includes(rol ?? '');

  const { data, isLoading, refetch, isRefetching } = useAusencias();
  const resolverM = useActualizarEstadoAusencia();

  async function handleResolver(ausencia: Ausencia, estado: 'aprobada' | 'rechazada') {
    const label = estado === 'aprobada' ? 'Aprobar' : 'Rechazar';
    const ok = await confirm({
      title: label,
      message: `¿${label} la solicitud de ${ausencia.trabajador_nombre ?? 'este trabajador'}?`,
      confirmLabel: label,
      destructive: estado === 'rechazada',
    });
    if (ok) resolverM.mutate({ id: ausencia.id, estado });
  }

  const ausencias = data?.data ?? [];

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['bottom']}>
      <FlatList
        data={ausencias}
        keyExtractor={(a) => String(a.id)}
        contentContainerClassName="px-5 py-4 gap-3 pb-12"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch}
            tintColor={theme.primary} colors={[theme.primary]} />
        }
        ListHeaderComponent={
          !isGestor ? (
            <TouchableOpacity
              onPress={() => router.push('/ausencia-nueva')}
              className="mb-3 flex-row items-center justify-center gap-2 rounded-2xl py-3 border border-dashed border-primary/40 bg-primary/5"
            >
              <Ionicons name="add-circle-outline" size={18} color={theme.primary} />
              <Text className="text-sm font-semibold" style={{ color: theme.primary }}>
                Nueva solicitud
              </Text>
            </TouchableOpacity>
          ) : null
        }
        ListEmptyComponent={
          isLoading ? (
            <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: 48 }} />
          ) : (
            <View className="items-center justify-center py-16 gap-3">
              <Ionicons name="calendar-clear-outline" size={48} color="#94A3B8" />
              <Text className="text-base font-semibold text-foreground">Sin ausencias</Text>
            </View>
          )
        }
        renderItem={({ item: a }) => (
          <View className="bg-card rounded-2xl px-4 py-4 gap-2 border border-border">
            <View className="flex-row items-start justify-between">
              <View className="flex-1 gap-0.5">
                {isGestor && a.trabajador_nombre && (
                  <Text className="text-xs font-semibold text-muted-foreground">
                    {a.trabajador_nombre} {a.trabajador_apellido}
                  </Text>
                )}
                <Text className="text-sm font-semibold text-foreground">{TIPO_LABEL[a.tipo] ?? a.tipo}</Text>
                <Text className="text-xs text-muted-foreground">{a.fecha_inicio} → {a.fecha_fin}</Text>
              </View>
              <Badge label={ESTADO_LABEL[a.estado] ?? a.estado} variant={ESTADO_VARIANT[a.estado] ?? 'default'} size="sm" />
            </View>
            {a.motivo ? <Text className="text-xs text-muted-foreground">{a.motivo}</Text> : null}

            {isGestor && a.estado === 'pendiente' && (() => {
              const resolvingThis = resolverM.isPending && resolverM.variables?.id === a.id;
              return (
                <View className="flex-row gap-2 mt-1">
                  <TouchableOpacity
                    onPress={() => handleResolver(a, 'rechazada')}
                    disabled={resolverM.isPending}
                    className="flex-1 items-center py-2 rounded-xl bg-danger/10 disabled:opacity-40"
                  >
                    {resolvingThis
                      ? <ActivityIndicator size="small" color="#DC2626" />
                      : <Text className="text-xs font-semibold text-danger">Rechazar</Text>}
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleResolver(a, 'aprobada')}
                    disabled={resolverM.isPending}
                    className="flex-1 items-center py-2 rounded-xl bg-success/10 disabled:opacity-40"
                  >
                    {resolvingThis
                      ? <ActivityIndicator size="small" color="#16A34A" />
                      : <Text className="text-xs font-semibold text-success">Aprobar</Text>}
                  </TouchableOpacity>
                </View>
              );
            })()}
          </View>
        )}
      />
    </SafeAreaView>
  );
}
