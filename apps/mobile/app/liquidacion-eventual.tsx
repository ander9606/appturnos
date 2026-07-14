import React from 'react';
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { usePeriodoEventual, useLiquidacionEventual, useLiquidarEventual } from '@/features/turnos/useTurnosEventual';
import { bogotaToday } from '@/features/turnos/turnosUtils';
import { Button } from '@/components/ui/Button';
import { useTheme } from '@/lib/theme';
import { useRoleGuard } from '@/components/RoleGuard';
import type { LineaLiquidacionEventual } from '@api-client';

const TRIMESTRE_LABELS: Record<1 | 2 | 3 | 4, string> = {
  1: 'Ene – Mar',
  2: 'Abr – Jun',
  3: 'Jul – Sep',
  4: 'Oct – Dic',
};

function cop(n: number): string {
  return '$' + Math.round(n).toLocaleString('es-CO');
}

function LineaRow({ item }: { item: LineaLiquidacionEventual }) {
  return (
    <View
      className="bg-card rounded-2xl px-4 py-4 gap-1.5"
      style={{ elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } }}
    >
      <View className="flex-row items-center justify-between gap-2">
        <Text className="text-sm font-semibold text-foreground flex-1" numberOfLines={1}>
          {item.nombre_completo}
        </Text>
        <Text className="text-base font-bold text-violet-700">{cop(item.total)}</Text>
      </View>
      <View className="flex-row gap-4">
        <View className="flex-row items-center gap-1">
          <Ionicons name="briefcase-outline" size={12} color="#94A3B8" />
          <Text className="text-xs text-muted-foreground">{item.turnos} turno{item.turnos !== 1 ? 's' : ''}</Text>
        </View>
        <View className="flex-row items-center gap-1">
          <Ionicons name="time-outline" size={12} color="#94A3B8" />
          <Text className="text-xs text-muted-foreground">{item.horas.toFixed(1)}h</Text>
        </View>
      </View>
    </View>
  );
}

export default function LiquidacionEventualScreen() {
  const theme = useTheme();
  const { data: periodo, isLoading: loadingPeriodo, refetch: refetchPeriodo } = usePeriodoEventual();
  const { data: liquidacion, isLoading: loadingLiq, refetch: refetchLiq, isRefetching } = useLiquidacionEventual(periodo?.id ?? null);
  const liquidarMutation = useLiquidarEventual();

  const isLoading = loadingPeriodo || loadingLiq;
  const lineas = liquidacion?.lineas ?? [];
  const totalGeneral = liquidacion?.total_general ?? 0;

  const hoy = bogotaToday();
  const puedeL = periodo && periodo.estado === 'abierto' && periodo.fecha_fin < hoy;

  const denied = useRoleGuard(['admin_empresa', 'jefe_turnos']);
  if (denied) return denied;

  function handleLiquidar() {
    if (!periodo) return;
    Alert.alert(
      'Liquidar trimestre',
      `¿Confirmar el pago de ${cop(totalGeneral)} a ${lineas.length} trabajador${lineas.length !== 1 ? 'es' : ''}? Esta acción no se puede deshacer.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Liquidar', style: 'destructive', onPress: () => liquidarMutation.mutate(periodo.id) },
      ]
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitle: 'Turnos eventuales',
          headerTitleStyle: { fontWeight: '700', fontSize: 17 },
          headerBackTitle: 'Atrás',
          headerTintColor: '#7C3AED',
          headerStyle: { backgroundColor: '#FFFFFF' },
          headerShadowVisible: true,
        }}
      />

      <SafeAreaView className="flex-1 bg-background" edges={['bottom']}>
        {isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color="#7C3AED" />
          </View>
        ) : !periodo ? (
          <View className="flex-1 items-center justify-center gap-3 px-8">
            <Ionicons name="calendar-outline" size={48} color="#CBD5E1" />
            <Text className="text-base font-semibold text-foreground text-center">Sin período activo</Text>
            <Text className="text-sm text-muted-foreground text-center">No hay un período trimestral abierto para tu empresa.</Text>
          </View>
        ) : (
          <FlatList
            data={lineas}
            keyExtractor={(item) => String(item.trabajador_id)}
            contentContainerStyle={{ padding: 20, gap: 10, paddingBottom: 40 }}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={isRefetching}
                onRefresh={() => { refetchPeriodo(); refetchLiq(); }}
                tintColor="#7C3AED"
                colors={['#7C3AED']}
              />
            }
            ListHeaderComponent={
              <View className="mb-2 gap-3">
                {/* Período info */}
                <View className="bg-violet-50 border border-violet-200 rounded-2xl px-5 py-4 gap-2">
                  <View className="flex-row items-center justify-between">
                    <View>
                      <Text className="text-xs text-violet-500 uppercase tracking-wide font-medium">
                        Trimestre {periodo.trimestre} · {periodo.anio}
                      </Text>
                      <Text className="text-lg font-bold text-violet-700">
                        {TRIMESTRE_LABELS[periodo.trimestre as 1 | 2 | 3 | 4]}
                      </Text>
                    </View>
                    <View className={`px-3 py-1.5 rounded-xl ${periodo.estado === 'abierto' ? 'bg-green-100' : 'bg-gray-100'}`}>
                      <Text className={`text-xs font-semibold ${periodo.estado === 'abierto' ? 'text-green-700' : 'text-gray-500'}`}>
                        {periodo.estado === 'abierto' ? 'Abierto' : 'Liquidado'}
                      </Text>
                    </View>
                  </View>
                  <Text className="text-xs text-violet-400">{periodo.fecha_inicio} – {periodo.fecha_fin}</Text>
                </View>

                {/* Resumen global */}
                {lineas.length > 0 && (
                  <View className="rounded-2xl px-5 py-4 flex-row items-center justify-between bg-violet-100">
                    <View className="gap-0.5">
                      <Text className="text-xs font-medium text-violet-500">Total a pagar</Text>
                      <Text className="text-2xl font-bold text-violet-700">{cop(totalGeneral)}</Text>
                    </View>
                    <View className="items-end gap-0.5">
                      <Text className="text-xs text-violet-500">{lineas.length} trabajador{lineas.length !== 1 ? 'es' : ''}</Text>
                      <Text className="text-xs text-violet-500">
                        {lineas.reduce((s, l) => s + l.turnos, 0)} turnos
                      </Text>
                    </View>
                  </View>
                )}
              </View>
            }
            renderItem={({ item }) => <LineaRow item={item} />}
            ItemSeparatorComponent={() => <View className="h-0" />}
            ListEmptyComponent={
              <View className="py-20 items-center gap-3 px-8">
                <Ionicons name="briefcase-outline" size={48} color="#CBD5E1" />
                <Text className="text-base font-semibold text-foreground text-center">Sin turnos eventuales</Text>
                <Text className="text-sm text-muted-foreground text-center">
                  No hay turnos completados en este trimestre.
                </Text>
              </View>
            }
            ListFooterComponent={
              puedeL ? (
                <View className="mt-4 gap-1">
                  <Button
                    label={liquidarMutation.isPending ? 'Liquidando…' : 'Liquidar trimestre'}
                    variant="primary"
                    size="lg"
                    fullWidth
                    loading={liquidarMutation.isPending}
                    onPress={handleLiquidar}
                  />
                  {!liquidarMutation.isPending && (
                    <Text className="text-xs text-muted-foreground text-center">No se puede deshacer</Text>
                  )}
                </View>
              ) : null
            }
          />
        )}
      </SafeAreaView>
    </>
  );
}
