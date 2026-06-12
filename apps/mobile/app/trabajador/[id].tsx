/**
 * Detalle del trabajador — vista + edición (admin) + desactivar (admin).
 *
 * Roles:
 *   admin_empresa → puede editar, desactivar y calificar turnos
 *   jefe_turnos   → puede calificar turnos (solo lectura para datos del trabajador)
 *   jefe_nomina / nomina → solo lectura
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';

import { useAuthStore } from '@/features/auth/useAuthStore';
import {
  useTrabajador,
  useActualizarTrabajador,
  useDesactivarTrabajador,
} from '@/features/equipo/useEquipo';
import {
  useAsignacionesTrabajador,
  useCalificar,
} from '@/features/turnos/useTurnos';
import { StarRating }      from '@/features/turnos/StarRating';
import { TrabajadorForm }  from '@/features/equipo/TrabajadorForm';
import type { TrabajadorFormValues } from '@/features/equipo/schemas';
import type { Asignacion } from '@api-client';
import { getInitials }       from '@/lib/formatters';
import { avatarColorForId, COLORS } from '@/lib/designTokens';

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
  const isAdmin  = usuario?.rol === 'admin_empresa';
  const canRate  = usuario?.rol === 'admin_empresa' || usuario?.rol === 'jefe_turnos';

  const [editing, setEditing] = useState(false);
  // Calificación inline: id de la asignación que se está calificando
  const [ratingId,       setRatingId]       = useState<number | null>(null);
  const [ratingStars,    setRatingStars]    = useState(5);
  const [ratingComment,  setRatingComment]  = useState('');

  const { data: t, isLoading, isError, refetch } = useTrabajador(numId);
  const actualizar  = useActualizarTrabajador(numId);
  const desactivar  = useDesactivarTrabajador();
  const calificar   = useCalificar();

  // Turnos recientes del trabajador (solo para roles que pueden ver asignaciones)
  const showTurnos = canRate || isAdmin;
  const { data: asignacionesData } = useAsignacionesTrabajador(
    showTurnos ? numId : null,
    { limit: 10 },
  );
  const turnosRecientes = (asignacionesData?.data ?? [])
    .filter((a) => a.estado === 'completado' || a.estado === 'no_presentado')
    .slice(0, 5);

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

  // ── Calificar ─────────────────────────────────────────────────────────

  async function handleCalificar() {
    if (!ratingId) return;
    try {
      await calificar.mutateAsync({
        id: ratingId,
        calificacion: ratingStars,
        comentario: ratingComment.trim() || undefined,
      });
      setRatingId(null);
      setRatingComment('');
      setRatingStars(5);
      Alert.alert('✓ Calificado', `Turno calificado con ${ratingStars}/5 estrellas.`);
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message: string }).message)
          : 'No se pudo guardar la calificación.';
      Alert.alert('Error', msg);
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
        <Ionicons name="warning-outline" size={48} color="#94A3B8" style={{ marginBottom: 12 }} />
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

  const avatarBg = avatarColorForId(t.id);

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
              {getInitials(t.nombre, t.apellido)}
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

        {/* Pending activation banner — shown to admin when worker hasn't set up login yet */}
        {isAdmin && t.usuario_id === null && (
          <View className="mx-4 mb-3 bg-warning/10 border border-warning/30 rounded-2xl p-4 flex-row gap-3">
            <Ionicons name="time-outline" size={20} color="#D97706" style={{ marginTop: 1 }} />
            <View className="flex-1 gap-1">
              <Text className="text-sm font-semibold" style={{ color: '#B45309' }}>Cuenta sin activar</Text>
              <Text className="text-xs text-muted-foreground">
                {t.cedula
                  ? `Pídele que descargue la app y use "Activar cuenta" con la cédula ${t.cedula}.`
                  : 'Pídele que descargue la app y use "Activar cuenta" con su número de cédula.'}
              </Text>
            </View>
          </View>
        )}

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

        {/* Ranking card */}
        <View className="mx-4 mt-3 bg-card rounded-2xl border border-border px-4 py-4 flex-row items-center justify-between">
          <Text className="text-sm text-muted-foreground">Calificación promedio</Text>
          {t.total_calificaciones > 0 ? (
            <View className="flex-row items-center gap-2">
              <StarRating mode="display" value={Number(t.ranking)} size="sm" />
              <Text className="text-xs text-muted-foreground">
                ({t.total_calificaciones} {t.total_calificaciones === 1 ? 'turno' : 'turnos'})
              </Text>
            </View>
          ) : (
            <Text className="text-sm text-muted-foreground italic">Sin calificaciones aún</Text>
          )}
        </View>

        {/* Turnos recientes — visible para gestores que pueden calificar */}
        {showTurnos && turnosRecientes.length > 0 && (
          <View className="mx-4 mt-3">
            <Text className="text-sm font-semibold text-foreground mb-2">
              Turnos recientes
            </Text>

            {turnosRecientes.map((a: Asignacion) => {
              const yaCalificado = a.calificacion != null;
              const isOpen       = ratingId === a.id;

              return (
                <View
                  key={a.id}
                  className="bg-card rounded-2xl border border-border mb-2 overflow-hidden"
                >
                  {/* Header row */}
                  <View className="px-4 py-3 flex-row items-center justify-between">
                    <View className="flex-1 mr-3">
                      <Text className="text-sm font-semibold text-foreground" numberOfLines={1}>
                        {(a as any).oferta_titulo ?? `Turno #${a.id}`}
                      </Text>
                      <Text className="text-xs text-muted-foreground">
                        {(a as any).oferta_fecha ?? ''}
                        {a.estado === 'no_presentado' ? '  ·  No presentado' : ''}
                      </Text>
                    </View>

                    {a.estado === 'completado' && (
                      yaCalificado ? (
                        <StarRating mode="display" value={a.calificacion} size="sm" />
                      ) : canRate ? (
                        <Pressable
                          onPress={() => {
                            setRatingId(isOpen ? null : a.id);
                            setRatingStars(5);
                            setRatingComment('');
                          }}
                          className="bg-warning/10 rounded-full px-3 py-1 active:opacity-70"
                        >
                          <Text className="text-warning text-xs font-semibold">
                            {isOpen ? 'Cancelar' : 'Calificar ★'}
                          </Text>
                        </Pressable>
                      ) : (
                        <Text className="text-xs text-muted-foreground italic">Sin calificar</Text>
                      )
                    )}
                  </View>

                  {/* Inline rating form */}
                  {isOpen && (
                    <View className="border-t border-border px-4 pb-4 pt-3 gap-3">
                      <View className="flex-row items-center justify-between">
                        <Text className="text-xs font-semibold text-muted-foreground">
                          CALIFICACIÓN
                        </Text>
                        <StarRating
                          mode="input"
                          value={ratingStars}
                          onChange={setRatingStars}
                          size="lg"
                        />
                      </View>

                      <TextInput
                        className="bg-background border border-border rounded-xl px-3 py-2 text-sm text-foreground"
                        placeholder="Comentario opcional…"
                        placeholderTextColor={COLORS.placeholder}
                        value={ratingComment}
                        onChangeText={setRatingComment}
                        maxLength={500}
                        multiline
                        numberOfLines={2}
                      />

                      <Pressable
                        onPress={handleCalificar}
                        disabled={calificar.isPending}
                        className={`h-10 rounded-xl items-center justify-center ${
                          calificar.isPending ? 'bg-primary/50' : 'bg-primary active:bg-primary/80'
                        }`}
                      >
                        {calificar.isPending ? (
                          <ActivityIndicator color="white" size="small" />
                        ) : (
                          <Text className="text-white font-bold text-sm">
                            Confirmar calificación
                          </Text>
                        )}
                      </Pressable>
                    </View>
                  )}
                </View>
              );
            })}
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
