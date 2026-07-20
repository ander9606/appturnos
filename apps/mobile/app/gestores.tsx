/**
 * Gestores — lista de gestores (jefe_turnos, jefe_nomina, nomina) de la empresa.
 * Permite al admin_empresa activar/desactivar usuarios gestores.
 */
import React from 'react';
import {
  View, Text, ScrollView, Pressable, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { authApi } from '@api-client';
import type { Gestor } from '@api-client';
import { useTheme } from '@/lib/theme';
import { useRoleGuard } from '@/components/RoleGuard';
import { apiErrorMessage } from '@/lib/apiErrorMessage';
import { confirm } from '@/lib/confirmDialog';

// ── Helpers ───────────────────────────────────────────────────────────────

const ROL_LABELS: Record<string, string> = {
  admin_empresa: 'Administrador',
  jefe_turnos:   'Jefe de Turnos',
  jefe_nomina:   'Jefe de Nómina',
  nomina:        'Nómina',
};

const ROL_COLORS: Record<string, string> = {
  admin_empresa: '#DC2626',
  jefe_turnos:   '#3B82F6',
  jefe_nomina:   '#8B5CF6',
  nomina:        '#10B981',
};

// ── Hooks ─────────────────────────────────────────────────────────────────

function useGestores() {
  return useQuery({
    queryKey: ['gestores'],
    queryFn: () => authApi.listarGestores(),
    staleTime: 60_000,
  });
}

function useSetActivoGestor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, activo }: { id: number; activo: boolean }) =>
      authApi.setActivoGestor(id, activo),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['gestores'] }),
  });
}

// ── GestorCard ────────────────────────────────────────────────────────────

function GestorCard({ gestor }: { gestor: Gestor }) {
  const toggleMutation = useSetActivoGestor();
  const rolColor = ROL_COLORS[gestor.rol] ?? '#64748B';

  const handleToggle = async () => {
    const accion = gestor.activo ? 'desactivar' : 'activar';
    const label = accion.charAt(0).toUpperCase() + accion.slice(1);
    const ok = await confirm({
      title: `¿${label} gestor?`,
      message: `${gestor.nombre}${gestor.apellido ? ` ${gestor.apellido}` : ''} quedará ${gestor.activo ? 'sin acceso' : 'con acceso'} a la app.`,
      confirmLabel: label,
      destructive: gestor.activo,
    });
    if (!ok) return;
    toggleMutation.mutate(
      { id: gestor.id, activo: !gestor.activo },
      { onError: (err) => Alert.alert('Error', apiErrorMessage(err, 'No se pudo actualizar el estado.')) }
    );
  };

  return (
    <View className="mx-4 mb-3 bg-card border border-border rounded-2xl overflow-hidden">
      <View className="px-4 py-4 flex-row items-center gap-3">
        {/* Avatar */}
        <View
          className="w-11 h-11 rounded-full items-center justify-center"
          style={{ backgroundColor: rolColor + '20' }}
        >
          <Text className="text-base font-bold" style={{ color: rolColor }}>
            {gestor.nombre[0].toUpperCase()}
            {(gestor.apellido?.[0] ?? '').toUpperCase()}
          </Text>
        </View>

        {/* Info */}
        <View className="flex-1">
          <Text className="text-sm font-semibold text-foreground" numberOfLines={1}>
            {gestor.nombre}{gestor.apellido ? ` ${gestor.apellido}` : ''}
          </Text>
          <Text className="text-xs text-muted-foreground" numberOfLines={1}>{gestor.email}</Text>
          <View
            className="mt-1 self-start rounded-full px-2 py-0.5"
            style={{ backgroundColor: rolColor + '20' }}
          >
            <Text className="text-xs font-semibold" style={{ color: rolColor }}>
              {ROL_LABELS[gestor.rol] ?? gestor.rol}
            </Text>
          </View>
        </View>

        {/* Status + toggle */}
        <View className="items-end gap-1">
          <View className={`rounded-full px-2 py-0.5 ${gestor.activo ? 'bg-success/15' : 'bg-muted'}`}>
            <Text className={`text-xs font-semibold ${gestor.activo ? 'text-success' : 'text-muted-foreground'}`}>
              {gestor.activo ? 'Activo' : 'Inactivo'}
            </Text>
          </View>
          {toggleMutation.isPending ? (
            <ActivityIndicator size="small" color="#64748B" />
          ) : (
            <Pressable
              onPress={handleToggle}
              className={`px-3 py-1.5 rounded-lg border active:opacity-60 ${
                gestor.activo ? 'border-danger' : 'border-success'
              }`}
            >
              <Text className={`text-xs font-semibold ${gestor.activo ? 'text-danger' : 'text-success'}`}>
                {gestor.activo ? 'Desactivar' : 'Activar'}
              </Text>
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────

export default function GestoresScreen() {
  const theme  = useTheme();
  const router = useRouter();
  const { data: gestores = [], isLoading, refetch, isRefetching } = useGestores();
  const denied = useRoleGuard(['admin_empresa']);

  const activos   = gestores.filter((g) => g.activo);
  const inactivos = gestores.filter((g) => !g.activo);

  if (denied) return denied;

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center" edges={['bottom']}>
        <Stack.Screen options={{ title: 'Gestores', headerShown: true }} />
        <ActivityIndicator size="large" color={theme.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['bottom']}>
      <Stack.Screen options={{ title: 'Gestores', headerShown: true }} />

      <ScrollView
        contentContainerStyle={{ paddingTop: 16, paddingBottom: 48 }}
        showsVerticalScrollIndicator={false}
      >
        {gestores.length === 0 ? (
          <View className="items-center justify-center py-20 gap-3 px-8">
            <Ionicons name="people-outline" size={48} color="#CBD5E1" />
            <Text className="text-base font-semibold text-muted-foreground text-center">
              Sin gestores creados
            </Text>
            <Text className="text-sm text-muted-foreground text-center">
              Crea gestores para que puedan administrar turnos y nómina.
            </Text>
            <Pressable
              onPress={() => router.push('/crear-gestor')}
              className="mt-2 h-11 px-6 rounded-xl items-center justify-center active:opacity-70"
              style={{ backgroundColor: theme.primary }}
            >
              <Text className="text-sm font-semibold text-white">Crear primer gestor</Text>
            </Pressable>
          </View>
        ) : (
          <>
            {activos.length > 0 && (
              <>
                <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-widest px-4 mb-3">
                  Activos ({activos.length})
                </Text>
                {activos.map((g) => <GestorCard key={g.id} gestor={g} />)}
              </>
            )}

            {inactivos.length > 0 && (
              <>
                <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-widest px-4 mb-3 mt-4">
                  Inactivos ({inactivos.length})
                </Text>
                {inactivos.map((g) => <GestorCard key={g.id} gestor={g} />)}
              </>
            )}
          </>
        )}
      </ScrollView>

      {/* FAB — siempre visible, no solo en el estado vacío */}
      <Pressable
        onPress={() => router.push('/crear-gestor')}
        accessibilityLabel="Crear gestor"
        className="absolute bottom-6 right-6 w-14 h-14 rounded-full items-center justify-center active:opacity-80"
        style={{
          backgroundColor: theme.primary,
          shadowColor: '#FF5A3C',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.35,
          shadowRadius: 8,
          elevation: 8,
        }}
      >
        <Ionicons name="person-add" size={22} color="#fff" />
      </Pressable>
    </SafeAreaView>
  );
}
