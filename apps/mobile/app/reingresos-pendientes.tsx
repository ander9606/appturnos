import React from 'react';
import {
  View, Text, FlatList, ActivityIndicator,
  TouchableOpacity, Alert, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '@/lib/theme';
import { ApiError, type SolicitudReingreso } from '@api-client';
import { fmtFechaCorta, fmtHora } from '@/features/nomina/trabajador/nominaTrabajadorUtils';
import {
  useReingresosPendientes,
  useAprobarReingreso,
  useRechazarReingreso,
} from '@/features/nomina/useNomina';

function ReingresoItem({ item }: { item: SolicitudReingreso }) {
  const aprobarMutation  = useAprobarReingreso();
  const rechazarMutation = useRechazarReingreso();
  const isPending        = aprobarMutation.isPending || rechazarMutation.isPending;

  const handleAprobar = () =>
    Alert.alert(
      'Aprobar reingreso',
      `¿Autorizas que ${item.trabajador_nombre} ${item.trabajador_apellido} regrese hoy?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Aprobar',
          onPress: async () => {
            try {
              await aprobarMutation.mutateAsync(item.id);
            } catch (err) {
              Alert.alert('Error', err instanceof ApiError ? err.message : 'Error al aprobar');
            }
          },
        },
      ],
    );

  const handleRechazar = () =>
    Alert.alert(
      'Rechazar reingreso',
      `¿Rechazas la solicitud de ${item.trabajador_nombre} ${item.trabajador_apellido}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Rechazar',
          style: 'destructive',
          onPress: async () => {
            try {
              await rechazarMutation.mutateAsync(item.id);
            } catch (err) {
              Alert.alert('Error', err instanceof ApiError ? err.message : 'Error al rechazar');
            }
          },
        },
      ],
    );

  return (
    <View className="bg-card border border-border rounded-2xl p-4 gap-3">
      <View className="flex-row items-start justify-between">
        <View className="gap-0.5">
          <Text className="text-base font-bold text-foreground">
            {item.trabajador_nombre} {item.trabajador_apellido}
          </Text>
          {item.fecha && (
            <Text className="text-sm text-muted-foreground">
              {fmtFechaCorta(item.fecha)}
              {' · '}
              {fmtHora(item.hora_entrada ?? null)} – {fmtHora(item.hora_salida ?? null)}
            </Text>
          )}
        </View>
        <View className="bg-warning-light rounded-full px-2.5 py-1">
          <Text className="text-xs font-semibold text-warning">Pendiente</Text>
        </View>
      </View>

      {item.motivo ? (
        <View className="bg-muted rounded-xl px-3 py-2">
          <Text className="text-xs text-muted-foreground italic">"{item.motivo}"</Text>
        </View>
      ) : null}

      <View className="flex-row gap-2">
        <TouchableOpacity
          onPress={handleRechazar}
          disabled={isPending}
          className="flex-1 border border-danger rounded-xl py-2.5 items-center"
        >
          <Text className="text-sm font-semibold text-danger">Rechazar</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={handleAprobar}
          disabled={isPending}
          className="flex-1 bg-success rounded-xl py-2.5 items-center"
        >
          {aprobarMutation.isPending
            ? <ActivityIndicator size="small" color="white" />
            : <Text className="text-sm font-semibold text-white">Aprobar</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function ReingresosPendientesScreen() {
  const theme = useTheme();
  const { data = [], isLoading, isRefetching, refetch } = useReingresosPendientes();

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['bottom']}>
      <Stack.Screen options={{ title: 'Reingresos pendientes' }} />

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : (
        <FlatList
          data={data}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => <ReingresoItem item={item} />}
          contentContainerStyle={{ padding: 20, gap: 12 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={theme.primary}
              colors={[theme.primary]}
            />
          }
          ListEmptyComponent={
            <View className="flex-1 items-center justify-center gap-3 pt-20">
              <Ionicons name="checkmark-circle-outline" size={48} color="#94A3B8" />
              <Text className="text-base font-semibold text-foreground text-center">
                Sin solicitudes pendientes
              </Text>
              <Text className="text-sm text-muted-foreground text-center">
                Aquí aparecerán las solicitudes de reingreso cuando los trabajadores las envíen.
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}
