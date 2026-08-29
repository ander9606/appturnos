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
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';

import { useAuthStore } from '@/features/auth/useAuthStore';
import { confirm } from '@/lib/confirmDialog';
import { showToast } from '@/lib/toast';
import {
  useTrabajador,
  useActualizarTrabajador,
  useDesactivarTrabajador,
  useEliminarTrabajadorDefinitivo,
} from '@/features/equipo/useEquipo';
import {
  useAsignacionesTrabajador,
  useCalificar,
} from '@/features/turnos/useTurnos';
import { StarRating }      from '@/features/turnos/StarRating';
import { TrabajadorForm }  from '@/features/equipo/TrabajadorForm';
import { MarcacionSelector } from '@/features/equipo/MarcacionSelector';
import { CargosCertificadosCard } from '@/features/equipo/CargosCertificadosCard';
import { usePuntosMarcaje } from '@/features/turnos/usePuntosMarcaje';
import type { TrabajadorFormValues } from '@/features/equipo/schemas';
import { ApiError } from '@api-client';
import type { Asignacion } from '@api-client';
import { COLORS } from '@/lib/designTokens';
import { Avatar } from '@/components/ui/Avatar';
import { useRoleGuard } from '@/components/RoleGuard';

const TIPO_LABELS: Record<string, string> = {
  turnos: 'Turnos',
  nomina: 'Nómina',
  ambos:  'Ambos',
};

const TIPO_DOC_LABELS: Record<string, string> = {
  CC: 'Cédula (CC)',
  CE: 'Cédula Ext. (CE)',
  PAS: 'Pasaporte',
};

const SEXO_LABELS: Record<string, string> = {
  M: 'Masculino',
  F: 'Femenino',
  otro: 'Otro',
};

const TIPO_CUENTA_LABELS: Record<string, string> = {
  ahorros: 'Ahorros',
  corriente: 'Corriente',
};

function fmtFechaCorta(iso: string | null | undefined) {
  if (!iso) return null;
  return new Date(iso.slice(0, 10) + 'T00:00:00').toLocaleDateString('es-CO', {
    year: 'numeric', month: 'long', day: 'numeric',
  });
}

function InfoRow({
  label, value, onCall,
}: {
  label: string;
  value: string | null | undefined;
  /** Si se pasa, muestra un botón de llamar junto al valor (abre el marcador con el número). */
  onCall?: () => void;
}) {
  if (value == null || value === '') return null;
  return (
    <View className="flex-row justify-between items-center py-3 border-b border-border last:border-b-0">
      <Text className="text-sm text-muted-foreground">{label}</Text>
      <View className="flex-row items-center gap-2 flex-1 ml-4 justify-end">
        <Text className="text-sm font-medium text-foreground text-right">{value}</Text>
        {onCall && (
          <Pressable
            onPress={onCall}
            hitSlop={8}
            accessibilityLabel={`Llamar a ${label}`}
            className="w-7 h-7 rounded-full bg-success/10 items-center justify-center active:opacity-70"
          >
            <Ionicons name="call" size={14} color="#16A34A" />
          </Pressable>
        )}
      </View>
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
  const [formDirty, setFormDirty] = useState(false);
  // Calificación inline: id de la asignación que se está calificando
  const [ratingId,       setRatingId]       = useState<number | null>(null);
  const [ratingStars,    setRatingStars]    = useState(5);
  const [ratingComment,  setRatingComment]  = useState('');

  const { data: t, isLoading, isError, refetch } = useTrabajador(numId);
  const { data: puntosMarcaje = [] } = usePuntosMarcaje(isAdmin && t?.tipo !== 'turnos');
  const actualizar  = useActualizarTrabajador(numId);
  const desactivar  = useDesactivarTrabajador();
  const eliminarDefinitivo = useEliminarTrabajadorDefinitivo();
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

  const denied = useRoleGuard(['admin_empresa', 'jefe_turnos', 'jefe_nomina', 'nomina']);
  if (denied) return denied;

  // ── Header right button (edit toggle) ────────────────────────────────

  async function toggleEditing() {
    if (editing && formDirty) {
      const ok = await confirm({
        title: '¿Descartar cambios?',
        message: 'Vas a perder lo que editaste en este formulario.',
        cancelLabel: 'Seguir editando',
        confirmLabel: 'Descartar',
        destructive: true,
      });
      if (ok) { setFormDirty(false); setEditing(false); }
      return;
    }
    setEditing((v) => !v);
  }

  const headerRight = isAdmin && t && t.activo
    ? () => (
        <Pressable
          onPress={toggleEditing}
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
        tipo_documento: (data.tipo_documento as 'CC' | 'CE' | 'PAS') || undefined,
        fecha_nacimiento: data.fecha_nacimiento || undefined,
        sexo:         (data.sexo as 'M' | 'F' | 'otro') || undefined,
        email:        data.email    || undefined,
        telefono:     data.telefono || undefined,
        contacto_emergencia_nombre: data.contacto_emergencia_nombre || undefined,
        contacto_emergencia_tel:    data.contacto_emergencia_tel    || undefined,
        cargo:        data.cargo    || undefined,
        tarifa_hora:  data.tarifa_hora,
        salario_base: data.salario_base,
        hora_entrada_esperada: data.hora_entrada_esperada || undefined,
        eps:          data.eps          || undefined,
        afp:          data.afp          || undefined,
        banco:        data.banco        || undefined,
        tipo_cuenta:  (data.tipo_cuenta as 'ahorros' | 'corriente') || undefined,
        numero_cuenta: data.numero_cuenta || undefined,
        ant_judiciales_fecha:     data.ant_judiciales_fecha     || undefined,
        ant_disciplinarios_fecha: data.ant_disciplinarios_fecha || undefined,
      });
      setEditing(false);
      showToast('Los datos del trabajador fueron actualizados.');
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
      showToast(`Turno calificado con ${ratingStars}/5 estrellas.`);
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message: string }).message)
          : 'No se pudo guardar la calificación.';
      Alert.alert('Error', msg);
    }
  }

  // ── Desactivar ────────────────────────────────────────────────────────

  async function confirmDesactivar() {
    const ok = await confirm({
      title: '¿Desactivar trabajador?',
      message: `${t?.nombre} ${t?.apellido} no podrá iniciar sesión ni recibir turnos.`,
      confirmLabel: 'Desactivar',
      destructive: true,
    });
    if (!ok) return;
    desactivar.mutate(numId, {
      onSuccess: () => router.back(),
      onError: () => Alert.alert('Error', 'No se pudo desactivar. Intenta de nuevo.'),
    });
  }

  // ── Eliminar definitivamente ──────────────────────────────────────────

  async function confirmEliminarDefinitivo() {
    const ok = await confirm({
      title: '¿Eliminar trabajador?',
      message: `Esto borra a ${t?.nombre} ${t?.apellido} para siempre. No se puede deshacer. Si tiene turnos, nómina o calificaciones registradas, no se podrá eliminar.`,
      confirmLabel: 'Eliminar',
      destructive: true,
    });
    if (!ok) return;
    eliminarDefinitivo.mutate(numId, {
      onSuccess: () => router.back(),
      onError: (err: unknown) => {
        const msg = err instanceof ApiError ? err.message : 'No se pudo eliminar. Intenta de nuevo.';
        Alert.alert('Error', msg);
      },
    });
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
      tipo_documento: t.tipo_documento ?? '',
      fecha_nacimiento: t.fecha_nacimiento?.slice(0, 10) ?? '',
      sexo:         t.sexo ?? '',
      email:        t.email        ?? '',
      telefono:     t.telefono     ?? '',
      contacto_emergencia_nombre: t.contacto_emergencia_nombre ?? '',
      contacto_emergencia_tel:    t.contacto_emergencia_tel    ?? '',
      cargo:        t.cargo        ?? '',
      tarifa_hora:  t.tarifa_hora  ?? undefined,
      salario_base: t.salario_base ?? undefined,
      hora_entrada_esperada: t.hora_entrada_esperada?.slice(0, 5) ?? '',
      eps:          t.eps          ?? '',
      afp:          t.afp          ?? '',
      banco:        t.banco        ?? '',
      tipo_cuenta:  t.tipo_cuenta  ?? '',
      numero_cuenta: t.numero_cuenta ?? '',
      ant_judiciales_fecha:     t.ant_judiciales_fecha?.slice(0, 10)     ?? '',
      ant_disciplinarios_fecha: t.ant_disciplinarios_fecha?.slice(0, 10) ?? '',
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
          onDirtyChange={setFormDirty}
        />
      </SafeAreaView>
    );
  }

  // ── Detail view ───────────────────────────────────────────────────────

  // Los trabajadores 'turnos' no tienen tarifa fija: cobran por turno aceptado (tarifa_dia de la oferta).
  const salarioLabel = t.tipo === 'turnos'
    ? 'Por turno aceptado'
    : t.tarifa_hora != null
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
          <View className="mb-3">
            <Avatar id={t.id} nombre={t.nombre} apellido={t.apellido} fotoB64={t.foto_perfil} size={80} expandable />
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
          <InfoRow label="Tipo de documento" value={t.tipo_documento ? TIPO_DOC_LABELS[t.tipo_documento] : null} />
          <InfoRow label="Correo"     value={t.email} />
          <InfoRow
            label="Teléfono"
            value={t.telefono}
            onCall={t.telefono ? () => Linking.openURL(`tel:${t.telefono}`) : undefined}
          />
          <InfoRow label="Fecha de nacimiento" value={fmtFechaCorta(t.fecha_nacimiento)} />
          <InfoRow label="Sexo"       value={t.sexo ? SEXO_LABELS[t.sexo] : null} />
          <InfoRow label="Salario"    value={salarioLabel} />
          <InfoRow
            label="Miembro desde"
            value={new Date(t.created_at).toLocaleDateString('es-CO', {
              year: 'numeric', month: 'long', day: 'numeric',
            })}
          />
        </View>

        {/* Contacto de emergencia */}
        {(t.contacto_emergencia_nombre || t.contacto_emergencia_tel) && (
          <View className="mx-4 mt-3 bg-card rounded-2xl border border-border px-4">
            <InfoRow label="Contacto de emergencia" value={t.contacto_emergencia_nombre} />
            <InfoRow
              label="Teléfono de emergencia"
              value={t.contacto_emergencia_tel}
              onCall={t.contacto_emergencia_tel ? () => Linking.openURL(`tel:${t.contacto_emergencia_tel}`) : undefined}
            />
          </View>
        )}

        {/* Seguridad social, banco y antecedentes — solo aplica a nómina/ambos */}
        {t.tipo !== 'turnos' && (t.eps || t.afp || t.banco || t.numero_cuenta || t.ant_judiciales_fecha || t.ant_disciplinarios_fecha) && (
          <View className="mx-4 mt-3 bg-card rounded-2xl border border-border px-4">
            <InfoRow label="EPS"  value={t.eps} />
            <InfoRow label="AFP"  value={t.afp} />
            <InfoRow label="Banco" value={t.banco} />
            <InfoRow label="Tipo de cuenta" value={t.tipo_cuenta ? TIPO_CUENTA_LABELS[t.tipo_cuenta] : null} />
            <InfoRow label="Número de cuenta" value={t.numero_cuenta} />
            <InfoRow label="Antecedentes judiciales" value={fmtFechaCorta(t.ant_judiciales_fecha)} />
            <InfoRow label="Antecedentes disciplinarios" value={fmtFechaCorta(t.ant_disciplinarios_fecha)} />
          </View>
        )}

        {/* Marcación — admin, solo trabajadores de nómina/ambos */}
        {isAdmin && t.tipo !== 'turnos' && (
          <View className="mx-4 mt-3 bg-card rounded-2xl border border-border p-4 gap-3">
            <Text className="text-sm font-semibold text-foreground">Marcación</Text>
            <MarcacionSelector trabajador={t} puntos={puntosMarcaje} />
          </View>
        )}

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

        {/* Cargos certificados — solo si ya activó su cuenta (existe el vínculo trabajador_empresa) */}
        {canRate && t.usuario_id !== null && (
          <CargosCertificadosCard trabajadorId={t.id} nombre={t.nombre} />
        )}

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

        {/* Eliminar button — admin only, once deactivated */}
        {isAdmin && !t.activo && (
          <View className="mx-4 mt-6">
            <Pressable
              onPress={confirmEliminarDefinitivo}
              disabled={eliminarDefinitivo.isPending}
              className="h-12 rounded-xl items-center justify-center bg-danger active:bg-danger/80 disabled:opacity-50"
            >
              <Text className="text-white font-semibold">
                {eliminarDefinitivo.isPending ? 'Eliminando…' : 'Eliminar trabajador'}
              </Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
