import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  Alert,
  ActivityIndicator,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import {
  useCargos,
  useCrearCargo,
  useActualizarCargo,
  useEliminarCargo,
} from '@/features/turnos/useTurnos';
import { COLORS } from '@/lib/designTokens';
import type { Cargo, CrearCargoPayload, ActualizarCargoPayload, ApiError } from '@api-client';

// ── Constants ─────────────────────────────────────────────────────────────

const GEOFENCE_LABELS: Record<string, string> = {
  oferta: 'Por oferta',
  fijo:   'Fijo',
  zonal:  'Zonal',
  libre:  'Libre',
};

const GEOFENCE_OPTIONS = ['oferta', 'fijo', 'zonal', 'libre'] as const;

// ── Form ──────────────────────────────────────────────────────────────────

type FormState = {
  nombre:        string;
  codigo:        string;
  descripcion:   string;
  tipo_geofence: string;
};

const EMPTY_FORM: FormState = {
  nombre:        '',
  codigo:        '',
  descripcion:   '',
  tipo_geofence: 'oferta',
};

// ── Screen ────────────────────────────────────────────────────────────────

export default function CargosScreen() {
  const { data: cargos = [], isLoading }   = useCargos();
  const crearMutation                      = useCrearCargo();
  const actualizarMutation                 = useActualizarCargo();
  const eliminarMutation                   = useEliminarCargo();

  const [modalVisible, setModalVisible]   = useState(false);
  const [editingCargo, setEditingCargo]   = useState<Cargo | null>(null);
  const [form, setForm]                   = useState<FormState>(EMPTY_FORM);

  const sistemaCargos = cargos.filter((c) => c.empresa_id === null);
  const empresaCargos = cargos.filter((c) => c.empresa_id !== null);

  function openCreate() {
    setEditingCargo(null);
    setForm(EMPTY_FORM);
    setModalVisible(true);
  }

  function openEdit(cargo: Cargo) {
    setEditingCargo(cargo);
    setForm({
      nombre:        cargo.nombre,
      codigo:        cargo.codigo,
      descripcion:   cargo.descripcion ?? '',
      tipo_geofence: cargo.tipo_geofence,
    });
    setModalVisible(true);
  }

  function handleGuardar() {
    const nombre = form.nombre.trim();
    if (!nombre) {
      Alert.alert('Campo requerido', 'El nombre del cargo es obligatorio.');
      return;
    }

    if (editingCargo) {
      const payload: ActualizarCargoPayload = {
        nombre,
        descripcion:   form.descripcion.trim() || null,
        tipo_geofence: form.tipo_geofence as ActualizarCargoPayload['tipo_geofence'],
      };
      actualizarMutation.mutate(
        { id: editingCargo.id, payload },
        {
          onSuccess: () => setModalVisible(false),
          onError: (err: unknown) =>
            Alert.alert('Error', (err as ApiError).message ?? 'No se pudo actualizar.'),
        },
      );
    } else {
      const payload: CrearCargoPayload = {
        nombre,
        ...(form.codigo.trim() ? { codigo: form.codigo.trim() } : {}),
        ...(form.descripcion.trim() ? { descripcion: form.descripcion.trim() } : {}),
        tipo_geofence: form.tipo_geofence as CrearCargoPayload['tipo_geofence'],
      };
      crearMutation.mutate(payload, {
        onSuccess: () => setModalVisible(false),
        onError: (err: unknown) =>
          Alert.alert('Error', (err as ApiError).message ?? 'No se pudo crear el cargo.'),
      });
    }
  }

  function handleEliminar(cargo: Cargo) {
    Alert.alert(
      'Eliminar cargo',
      `¿Eliminar "${cargo.nombre}"? Si está asignado a trabajadores, se desactivará en lugar de eliminarse.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () =>
            eliminarMutation.mutate(cargo.id, {
              onSuccess: (result) => {
                if (result.desactivado) {
                  Alert.alert(
                    'Cargo desactivado',
                    `"${cargo.nombre}" estaba asignado a ${result.usos} trabajador(es) y fue desactivado.`,
                  );
                }
              },
              onError: (err: unknown) =>
                Alert.alert('Error', (err as ApiError).message ?? 'No se pudo eliminar.'),
            }),
        },
      ],
    );
  }

  const isSaving = crearMutation.isPending || actualizarMutation.isPending;

  return (
    <>
      <Stack.Screen
        options={{ title: 'Gestión de cargos', headerTintColor: COLORS.info }}
      />
      <SafeAreaView className="flex-1 bg-background" edges={['bottom']}>
        {isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color={COLORS.info} />
          </View>
        ) : (
          <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 96 }}>

            {/* ── Cargos del sistema ───────────────────────────────── */}
            <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">
              Sistema ({sistemaCargos.length})
            </Text>
            <View className="flex-row flex-wrap gap-2 mb-8">
              {sistemaCargos.map((c) => (
                <View
                  key={c.id}
                  className="flex-row items-center gap-1.5 bg-card border border-border rounded-xl px-3 py-2"
                >
                  <Ionicons name="briefcase-outline" size={13} color="#64748B" />
                  <Text className="text-sm text-foreground">{c.nombre}</Text>
                </View>
              ))}
              {sistemaCargos.length === 0 && (
                <Text className="text-sm text-muted-foreground">Sin cargos de sistema</Text>
              )}
            </View>

            {/* ── Cargos de la empresa ─────────────────────────────── */}
            <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">
              Mi empresa ({empresaCargos.length})
            </Text>

            {empresaCargos.length === 0 ? (
              <View className="bg-card border border-dashed border-border rounded-2xl p-6 items-center gap-3">
                <Ionicons name="briefcase-outline" size={32} color="#94A3B8" />
                <Text className="text-sm text-muted-foreground text-center">
                  Aún no tienes cargos personalizados.{'\n'}Crea uno con el botón +
                </Text>
              </View>
            ) : (
              <View className="bg-card border border-border rounded-2xl overflow-hidden">
                {empresaCargos.map((cargo, idx) => (
                  <View
                    key={cargo.id}
                    className={`px-4 py-4 flex-row items-center gap-3 ${idx < empresaCargos.length - 1 ? 'border-b border-border' : ''}`}
                  >
                    <View className="w-9 h-9 rounded-full bg-info/10 items-center justify-center flex-shrink-0">
                      <Ionicons name="briefcase-outline" size={16} color={COLORS.info} />
                    </View>

                    <View className="flex-1 gap-0.5">
                      <View className="flex-row items-center gap-2 flex-wrap">
                        <Text className="text-sm font-semibold text-foreground">
                          {cargo.nombre}
                        </Text>
                        <Text className="text-xs text-muted-foreground">{cargo.codigo}</Text>
                        {!cargo.activo && (
                          <View className="bg-danger/10 px-2 py-0.5 rounded-full">
                            <Text className="text-xs text-danger">Inactivo</Text>
                          </View>
                        )}
                      </View>
                      {!!cargo.descripcion && (
                        <Text className="text-xs text-muted-foreground" numberOfLines={1}>
                          {cargo.descripcion}
                        </Text>
                      )}
                      <View className="flex-row mt-0.5">
                        <View className="bg-info/10 px-2 py-0.5 rounded-full self-start">
                          <Text className="text-xs text-info">
                            {GEOFENCE_LABELS[cargo.tipo_geofence] ?? cargo.tipo_geofence}
                          </Text>
                        </View>
                      </View>
                    </View>

                    <View className="flex-row items-center gap-1.5">
                      <Pressable
                        onPress={() => openEdit(cargo)}
                        hitSlop={8}
                        className="w-8 h-8 rounded-full bg-muted items-center justify-center active:opacity-70"
                      >
                        <Ionicons name="pencil-outline" size={15} color="#64748B" />
                      </Pressable>
                      <Pressable
                        onPress={() => handleEliminar(cargo)}
                        hitSlop={8}
                        className="w-8 h-8 rounded-full bg-danger/10 items-center justify-center active:opacity-70"
                        disabled={eliminarMutation.isPending}
                      >
                        <Ionicons name="trash-outline" size={15} color={COLORS.danger} />
                      </Pressable>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </ScrollView>
        )}

        {/* FAB */}
        <Pressable
          onPress={openCreate}
          className="absolute bottom-6 right-6 w-14 h-14 rounded-full items-center justify-center active:opacity-80"
          style={{
            backgroundColor: COLORS.info,
            shadowColor: '#3B82F6',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.35,
            shadowRadius: 8,
            elevation: 8,
          }}
        >
          <Ionicons name="add" size={28} color="#fff" />
        </Pressable>
      </SafeAreaView>

      {/* ── Modal crear / editar ──────────────────────────────────── */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          className="flex-1 bg-background"
        >
          <ScrollView
            contentContainerStyle={{ padding: 24, paddingBottom: 40 }}
            keyboardShouldPersistTaps="handled"
          >
            {/* Header */}
            <View className="flex-row items-center justify-between mb-6">
              <Text className="text-lg font-bold text-foreground">
                {editingCargo ? 'Editar cargo' : 'Nuevo cargo'}
              </Text>
              <Pressable onPress={() => setModalVisible(false)} hitSlop={8}>
                <Ionicons name="close" size={24} color="#64748B" />
              </Pressable>
            </View>

            {/* Nombre */}
            <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2">
              Nombre *
            </Text>
            <View className="bg-card border border-border rounded-2xl overflow-hidden mb-4">
              <TextInput
                value={form.nombre}
                onChangeText={(v) => setForm((f) => ({ ...f, nombre: v }))}
                placeholder="Ej. Auxiliar de bodega"
                placeholderTextColor={COLORS.placeholder}
                className="px-4 h-14 text-base text-foreground"
                autoCorrect={false}
                autoFocus={!editingCargo}
              />
            </View>

            {/* Código — solo al crear */}
            {!editingCargo && (
              <>
                <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2">
                  Código{' '}
                  <Text className="normal-case font-normal">(opcional — se genera automático)</Text>
                </Text>
                <View className="bg-card border border-border rounded-2xl overflow-hidden mb-4">
                  <TextInput
                    value={form.codigo}
                    onChangeText={(v) =>
                      setForm((f) => ({
                        ...f,
                        codigo: v.toLowerCase().replace(/[^a-z0-9_]/g, '_'),
                      }))
                    }
                    placeholder="Ej. aux_bodega"
                    placeholderTextColor={COLORS.placeholder}
                    className="px-4 h-14 text-base text-foreground"
                    autoCorrect={false}
                    autoCapitalize="none"
                  />
                </View>
              </>
            )}

            {/* Descripción */}
            <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2">
              Descripción{' '}
              <Text className="normal-case font-normal">(opcional)</Text>
            </Text>
            <View className="bg-card border border-border rounded-2xl overflow-hidden mb-4">
              <TextInput
                value={form.descripcion}
                onChangeText={(v) => setForm((f) => ({ ...f, descripcion: v }))}
                placeholder="Funciones principales del cargo…"
                placeholderTextColor={COLORS.placeholder}
                className="px-4 py-3 text-base text-foreground"
                multiline
                numberOfLines={3}
                style={{ minHeight: 80, textAlignVertical: 'top' }}
              />
            </View>

            {/* Tipo geofence */}
            <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">
              Tipo de geofence
            </Text>
            <View className="flex-row flex-wrap gap-2 mb-8">
              {GEOFENCE_OPTIONS.map((opt) => {
                const active = form.tipo_geofence === opt;
                return (
                  <Pressable
                    key={opt}
                    onPress={() => setForm((f) => ({ ...f, tipo_geofence: opt }))}
                    className={`px-4 py-2 rounded-xl border active:opacity-70 ${
                      active ? 'border-info' : 'bg-card border-border'
                    }`}
                    style={active ? { backgroundColor: COLORS.info } : {}}
                  >
                    <Text
                      className={`text-sm font-medium ${active ? 'text-white' : 'text-foreground'}`}
                    >
                      {GEOFENCE_LABELS[opt]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Guardar */}
            <Pressable
              onPress={handleGuardar}
              disabled={isSaving}
              className="h-14 rounded-2xl items-center justify-center active:opacity-80 disabled:opacity-40"
              style={{ backgroundColor: COLORS.info }}
            >
              {isSaving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="text-base font-semibold text-white">
                  {editingCargo ? 'Guardar cambios' : 'Crear cargo'}
                </Text>
              )}
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}
