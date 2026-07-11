/**
 * Conciliación de personal: vincula trabajadores de App Turnos con empleados de
 * logiq360. Muestra una sugerencia de match por nombre y permite elegir manualmente.
 * Solo visible para admin_empresa.
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { useConciliacion, useVincularEmpleado } from '@/features/integracion/useIntegracion';
import { useTheme } from '@/lib/theme';
import { useRoleGuard } from '@/components/RoleGuard';
import type { TrabajadorPendiente, CandidatoLogiq360 } from '@api-client';

function PendienteCard({
  t,
  candidatos,
  onVincular,
  vinculando,
}: {
  t: TrabajadorPendiente;
  candidatos: CandidatoLogiq360[];
  onVincular: (empleadoId: number) => void;
  vinculando: boolean;
}) {
  const theme = useTheme();
  const [verTodos, setVerTodos] = useState(false);

  return (
    <View className="bg-card border-b border-border px-4 py-4 gap-2">
      <View>
        <Text className="text-sm font-semibold text-foreground">{t.nombre} {t.apellido}</Text>
        {t.cedula ? <Text className="text-xs text-muted-foreground">CC {t.cedula}</Text> : null}
      </View>

      {t.sugerencia ? (
        <View className="flex-row items-center justify-between bg-success/10 border border-success/30 rounded-xl px-3 py-2">
          <View className="flex-1">
            <Text className="text-xs text-muted-foreground">Sugerido en logiq360</Text>
            <Text className="text-sm text-foreground">{t.sugerencia.nombre}</Text>
          </View>
          <Pressable
            onPress={() => onVincular(t.sugerencia!.id)}
            disabled={vinculando}
            className="px-3 py-1.5 rounded-xl"
            style={{ backgroundColor: theme.primary }}
          >
            <Text className="text-xs font-semibold text-white">Vincular</Text>
          </Pressable>
        </View>
      ) : (
        <Text className="text-xs text-warning">Sin coincidencia automática — elige manualmente.</Text>
      )}

      <Pressable onPress={() => setVerTodos((v) => !v)} className="self-start">
        <Text className="text-xs font-medium" style={{ color: theme.primary }}>
          {verTodos ? 'Ocultar candidatos' : t.sugerencia ? 'Elegir otro' : 'Ver candidatos'}
        </Text>
      </Pressable>

      {verTodos && (
        <View className="gap-1">
          {candidatos.length === 0 ? (
            <Text className="text-xs text-muted-foreground">No hay empleados de tipo turnos en logiq360.</Text>
          ) : (
            candidatos.map((c) => (
              <Pressable
                key={c.id}
                onPress={() => onVincular(c.id)}
                disabled={vinculando}
                className="flex-row items-center justify-between border border-border rounded-xl px-3 py-2 active:opacity-70"
              >
                <Text className="text-sm text-foreground flex-1">{c.nombre} {c.apellido}</Text>
                <Ionicons name="link-outline" size={16} color={theme.primary} />
              </Pressable>
            ))
          )}
        </View>
      )}
    </View>
  );
}

export default function ConciliacionScreen() {
  const theme = useTheme();
  const { data, isLoading, isRefetching, refetch } = useConciliacion();
  const { mutateAsync: vincular, isPending } = useVincularEmpleado();
  const denied = useRoleGuard(['admin_empresa']);
  if (denied) return denied;

  async function handleVincular(trabajadorId: number, empleadoId: number) {
    try {
      await vincular({ trabajadorId, empleadoId });
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'No se pudo vincular.');
    }
  }

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator size="large" color={theme.primary} />
      </SafeAreaView>
    );
  }

  const pendientes = data?.pendientes ?? [];
  const candidatos = data?.candidatos ?? [];

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['bottom']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={theme.primary} />
        }
      >
        <View className="px-4 pt-4 pb-6 gap-1" style={{ backgroundColor: '#6366F1' }}>
          <Text className="text-white text-lg font-bold">Conciliación de personal</Text>
          <Text className="text-white/70 text-sm">
            Vincula tus trabajadores con los empleados de logiq360
          </Text>
        </View>

        {pendientes.length === 0 ? (
          <View className="items-center justify-center px-8 py-16 gap-3">
            <Ionicons name="checkmark-circle-outline" size={48} color="#22C55E" />
            <Text className="text-base font-semibold text-foreground text-center">
              Todo el personal está vinculado
            </Text>
            <Text className="text-sm text-muted-foreground text-center">
              No hay trabajadores pendientes de emparejar con logiq360.
            </Text>
          </View>
        ) : (
          <>
            <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 pt-6 pb-2">
              {pendientes.length} pendiente{pendientes.length !== 1 ? 's' : ''}
            </Text>
            {pendientes.map((t) => (
              <PendienteCard
                key={t.id}
                t={t}
                candidatos={candidatos}
                vinculando={isPending}
                onVincular={(empleadoId) => handleVincular(t.id, empleadoId)}
              />
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
