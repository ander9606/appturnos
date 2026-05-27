/**
 * Detalle del trabajador — vista + edición (admin) + desactivar (admin).
 *
 * Roles:
 *   admin_empresa → puede editar y desactivar
 *   jefe_turnos / jefe_nomina / nomina → solo lectura
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';

import { useAuthStore } from '@/features/auth/useAuthStore';
import {
  useTrabajador,
  useActualizarTrabajador,
  useDesactivarTrabajador,
} from '@/features/equipo/useEquipo';
import { TrabajadorForm } from '@/features/equipo/TrabajadorForm';
import type { TrabajadorFormValues } from '@/features/equipo/schemas';

// ── Helpers ───────────────────────────────────────────────────────────────

function initials(nombre: string, apellido: string): string {
  return `${nombre[0] ?? ''}${apellido[0] ?? ''}`.toUpperCase();
}

const AVATAR_COLORS = [
  '#FF5A3C', // primary
  '#3B82F6', // info
  '#059669', // success
  '#F59E0B', // warning
  '#8B5CF6', // purple
  '#EC4899', // pink
];

const TIPO_LABELS: Record<string, string> = {
  turnos: 'Turnos',
  nomina: 'Nómina',
  ambos:  'Ambos',
};

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (value == null || value === '') return null;
  return (
    <View className="flex-row justify-between py-3 border-b border-border last:border-b-0">
      <Text className="text-sm text-muted-foreground">{label}</Text>
      <Text className="text-sm font-medium text-foreground text-right flex-1 ml-4">
        {value}
      </Text>
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────

export default function TrabajadorDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const numId   = Number(id);
  const router  = useRouter();
  const usuario = useAuthStore((s) => s.usuario);
  const isAdmin = usuario?.rol === 'admin_empresa';

  const [editing, setEditing] = useState(false);

  const { data: t, isLoading, isError, refetch } = useTrabajador(numId);
  const actualizar  = useActualizarTrabajador(numId);
  const desactivar  = useDesactivarTrabajador();

  // ── Header right button (edit toggle) ────────────────────────────────

  const headerRight = isAdmin && t && t.activo
    ? () => (
        <Pressable
          onPress={() => setEditing((v) => !v)}
          hitSlop={10}
          className="pr-1"
        >
          <Text className="text-primary font-semibold text-sm">
            {editing ? 'Cancelar' : 'Editar'}
          </Text>
        </Pressable>
      )
    : undefined;

  // ── Submit edit ───────────────────────────────────────────────────────

  async function handleUpdate(data: TrabajadorFormValues) {
    try {
      await actualizar.mutateAsync({
        nombre:       data.nombre,
        apellido:     data.apellido,
        tipo:         data.tipo,
        cedula:       data.cedula   || undefined,
        email:        data.email    || undefined,
        telefono:     data.telefono || undefined,
        cargo:        data.cargo    || undefined,
        tarifa_hora:  data.tarifa_hora,
        salario_base: data.salario_base,
      });
      setEditing(false);
      Alert.alert('✓ Guardado', 'Los datos del trabajador fueron actualizados.');
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message: string }).message)
          : 'Ocurrió un error al guardar.';
      Alert.alert('Error', msg);
      throw err;
    }
  }

  // ── Desactivar ────────────────────────────────────────────────────────

  function confirmDesactivar() {
    Alert.alert(
      '¿Desactivar trabajador?',
      `${t?.nombre} ${t?.apellido} no podrá iniciar sesión ni recibir turnos.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Desactivar',
          style: 'destructive',
          onPress: () =>
            desactivar.mutate(numId, {
              onSuccess: () => router.back(),
              onError: () =>
                Alert.alert('Error', 'No se pudo desactivar. Intenta de nuevo.'),
            }),
        },
      ],
    );
  }

  // ── Loading / Error states ────────────────────────────────────────────

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center" edges={['bottom']}>
        <Stack.Screen options={{ title: 'Trabajador', headerShown: true, headerRight }} />
        <ActivityIndicator color="#FF5A3C" />
      </SafeAreaView>
    );
  }

  if (isError || !t) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center px-8" edges={['bottom']}>
        <Stack.Screen options={{ title: 'Trabajador', headerShown: true }} />
        <Text className="text-4xl mb-3">⚠️</Text>
        <Text className="text-base font-semibold text-foreground">No se pudo cargar</Text>
        <Pressable onPress={() => refetch()} className="mt-4">
          <Text className="text-primary font-semibold">Reintentar</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  // ── Edit mode ─────────────────────────────────────────────────────────

  if (editing) {
    const defaults: Partial<TrabajadorFormValues> = {
      nombre:       t.nombre,
      apellido:     t.apellido,
      tipo:         t.tipo,
      cedula:       t.cedula       ?? '',
      email:        t.email        ?? '',
      telefono:     t.telefono     ?? '',
      cargo:        t.cargo        ?? '',
      tarifa_hora:  t.tarifa_hora  ?? undefined,
      salario_base: t.salario_base ?? undefined,
    };
    return (
      <SafeAreaView className="flex-1 bg-background" edges={['bottom']}>
        <Stack.Screen
          options={{
            title: 'Editar trabajador',
            headerShown: true,
            headerBackTitle: '',
            headerRight,
          }}
        />
        <TrabajadorForm
          defaultValues={defaults}
          onSubmit={handleUpdate}
          submitLabel="Guardar cambios"
          submittingLabel="Guardando…"
        />
      </SafeAreaView>
    );
  }

  // ── Detail view ───────────────────────────────────────────────────────

  const avatarBg = AVATAR_COLORS[t.id % AVATAR_COLORS.length];

  const salarioLabel = t.tarifa_hora != null
    ? `$${Number(t.tarifa_hora).toLocaleString('es-CO')} / hora`
    : t.salario_base != null
    ? `$${Number(t.salario_base).toLocaleString('es-CO')} / mes`
    : 'Sin configurar';

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['bottom']}>
      <Stack.Screen
        options={{
          title: `${t.apellido}, ${t.nombre}`,
          headerShown: true,
          headerBackTitle: 'Equipo',
          animation: 'slide_from_right',
          headerRight,
        }}
      />

      <ScrollView
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <View className="items-center pt-8 pb-6 px-4">
          <View
            className="w-20 h-20 rounded-full items-center justify-center mb-3"
            style={{ backgroundColor: avatarBg }}
          >
            <Text className="text-white font-bold text-2xl">
              {initials(t.nombre, t.apellido)}
            </Text>
          </View>
          <Text className="text-xl font-bold text-foreground">
            {t.nombre} {t.apellido}
          </Text>
          {t.cargo && (
            <Text className="text-sm text-muted-foreground mt-0.5">{t.cargo}</Text>
          )}
          <View className="flex-row gap-2 mt-2 items-center">
            <View className="bg-primary/10 rounded-full px-3 py-1">
              <Text className="text-primary text-xs font-semibold">
                {TIPO_LABELS[t.tipo] ?? t.tipo}
              </Text>
            </View>
            {!t.activo && (
              <View className="bg-danger/10 rounded-full px-3 py-1">
                <Text className="text-danger text-xs font-semibold">Inactivo</Text>
              </View>
            )}
          </View>
        </View>

        {/* Info card */}
        <View className="mx-4 bg-card rounded-2xl border border-border px-4">
          <InfoRow label="Cédula"     value={t.cedula} />
          <InfoRow label="Correo"     value={t.email} />
          <InfoRow label="Teléfono"   value={t.telefono} />
          <InfoRow label="Salario"    value={salarioLabel} />
          <InfoRow
            label="Miembro desde"
            value={new Date(t.created_at).toLocaleDateString('es-CO', {
              year: 'numeric', month: 'long', day: 'numeric',
            })}
          />
        </View>

        {/* Ranking card (if any ratings) */}
        {t.total_calificaciones > 0 && (
          <View className="mx-4 mt-3 bg-card rounded-2xl border border-border px-4 py-4 flex-row items-center justify-between">
            <Text className="text-sm text-muted-foreground">Calificación promedio</Text>
            <View className="flex-row items-center gap-1">
              <Text className="text-warning text-base">★</Text>
              <Text className="text-base font-bold text-foreground">
                {Number(t.ranking).toFixed(1)}
              </Text>
              <Text className="text-sm text-muted-foreground">
                ({t.total_calificaciones})
              </Text>
            </View>
          </View>
        )}

        {/* Desactivar button — admin only, active workers */}
        {isAdmin && t.activo && (
          <View className="mx-4 mt-6">
            <Pressable
              onPress={confirmDesactivar}
              className="h-12 rounded-xl items-center justify-center border border-danger active:bg-danger/10"
            >
              <Text className="text-danger font-semibold">Desactivar trabajador</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
