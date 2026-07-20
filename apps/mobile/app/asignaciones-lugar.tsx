/**
 * AsignacionesLugar — gestión de tipo de marcación y punto geofence
 * por trabajador de nómina (admin_empresa / jefe_nomina).
 *
 * Libre  → el trabajador puede marcar desde cualquier coordenada.
 * Fijo   → debe estar dentro del radio del punto_marcaje asignado.
 */

import React from 'react';
import {
  View, Text, FlatList, ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '@/lib/theme';
import { getInitials } from '@/lib/formatters';
import { useTrabajadores } from '@/features/equipo/useEquipo';
import { usePuntosMarcaje } from '@/features/turnos/usePuntosMarcaje';
import { MarcacionSelector } from '@/features/equipo/MarcacionSelector';
import { useRoleGuard } from '@/components/RoleGuard';
import type { Trabajador, PuntoMarcaje } from '@api-client';

// ── Fila de trabajador ────────────────────────────────────────────────────────

function FilaTrabajador({
  t,
  puntos,
}: {
  t: Trabajador;
  puntos: PuntoMarcaje[];
}) {
  return (
    <View
      className="bg-card rounded-2xl px-4 py-3 gap-3"
      style={{ elevation: 1, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6 }}
    >
      <View className="flex-row items-center gap-3">
        <View className="w-10 h-10 rounded-full bg-primary/10 items-center justify-center flex-shrink-0">
          <Text className="text-sm font-bold text-primary">
            {getInitials(t.nombre, t.apellido)}
          </Text>
        </View>
        <Text className="flex-1 text-sm font-semibold text-foreground" numberOfLines={1}>
          {t.nombre} {t.apellido}
        </Text>
      </View>

      <MarcacionSelector trabajador={t} puntos={puntos} />
    </View>
  );
}

// ── Pantalla principal ────────────────────────────────────────────────────────

export default function AsignacionesLugarScreen() {
  const theme = useTheme();

  const {
    data: resp,
    isLoading: loadingT,
    isRefetching,
    refetch: refetchT,
  } = useTrabajadores({ tipo: 'nomina', activo: true });

  const { data: puntos = [], isLoading: loadingP, refetch: refetchP } = usePuntosMarcaje();

  const trabajadores = resp?.data ?? [];
  const fijos  = trabajadores.filter((t) => t.tipo_marcacion === 'fijo').length;
  const zonales = trabajadores.filter((t) => t.tipo_marcacion === 'zonal').length;
  const libres = trabajadores.filter((t) => t.tipo_marcacion === 'libre').length;

  const isLoading = loadingT || loadingP;
  const onRefresh = () => { refetchT(); refetchP(); };

  const denied = useRoleGuard(['admin_empresa', 'jefe_nomina']);
  if (denied) return denied;

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['bottom']}>
      <Stack.Screen options={{ title: 'Asignaciones de lugar', headerShown: true }} />

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : (
        <FlatList
          data={trabajadores}
          keyExtractor={(t) => String(t.id)}
          renderItem={({ item }) => <FilaTrabajador t={item} puntos={puntos} />}
          ItemSeparatorComponent={() => <View className="h-2" />}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={onRefresh}
              tintColor={theme.primary}
              colors={[theme.primary]}
            />
          }
          ListHeaderComponent={
            <View className="gap-3 pb-3">
              <View className="bg-indigo-600 rounded-2xl px-5 py-4 gap-1">
                <Text className="text-white/80 text-xs font-medium uppercase tracking-wide">
                  Ubicaciones de marcación
                </Text>
                <View className="flex-row items-baseline gap-2">
                  <Text className="text-white text-3xl font-extrabold">{trabajadores.length}</Text>
                  <Text className="text-white/80 text-base">trabajadores de nómina</Text>
                </View>
                <View className="flex-row gap-4 mt-1">
                  <View className="flex-row items-center gap-1">
                    <View className="w-1.5 h-1.5 rounded-full bg-white/70" />
                    <Text className="text-white/80 text-xs">{fijos} fijo{fijos !== 1 ? 's' : ''}</Text>
                  </View>
                  <View className="flex-row items-center gap-1">
                    <View className="w-1.5 h-1.5 rounded-full bg-white/55" />
                    <Text className="text-white/80 text-xs">{zonales} zonal{zonales !== 1 ? 'es' : ''}</Text>
                  </View>
                  <View className="flex-row items-center gap-1">
                    <View className="w-1.5 h-1.5 rounded-full bg-white/40" />
                    <Text className="text-white/80 text-xs">{libres} libre{libres !== 1 ? 's' : ''}</Text>
                  </View>
                </View>
              </View>

              <View className="bg-muted rounded-xl px-4 py-2.5 flex-row items-start gap-2">
                <Ionicons name="information-circle-outline" size={14} color="#64748B" className="mt-0.5" />
                <Text className="text-xs text-muted-foreground flex-1">
                  <Text className="font-semibold">Fijo</Text>: debe estar dentro del radio de un único punto asignado.{' '}
                  <Text className="font-semibold">Zonal</Text>: puede marcar desde cualquiera de los puntos zonales de la empresa.{' '}
                  <Text className="font-semibold">Libre</Text>: puede marcar desde cualquier lugar.
                </Text>
              </View>
            </View>
          }
          ListEmptyComponent={
            <View className="py-16 items-center gap-3 px-8">
              <Ionicons name="people-outline" size={40} color="#94A3B8" />
              <Text className="text-base font-semibold text-foreground text-center">
                Sin trabajadores de nómina activos
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}
