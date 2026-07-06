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
import * as Location from 'expo-location';

import {
  usePuntosMarcaje,
  useCrearPuntoMarcaje,
  useActualizarPuntoMarcaje,
  useEliminarPuntoMarcaje,
} from '@/features/turnos/usePuntosMarcaje';
import { COLORS } from '@/lib/designTokens';
import type { PuntoMarcaje, ApiError } from '@api-client';

// ── Helpers ───────────────────────────────────────────────────────────────

function formatCoord(v: number | string, decimals = 6) {
  return Number(v).toFixed(decimals);
}

// ── Form ──────────────────────────────────────────────────────────────────

type FormState = {
  nombre:       string;
  descripcion:  string;
  latitud:      string;
  longitud:     string;
  radio_metros: string;
  tipo:         'fijo' | 'zonal';
};

const EMPTY_FORM: FormState = {
  nombre:       '',
  descripcion:  '',
  latitud:      '',
  longitud:     '',
  radio_metros: '100',
  tipo:         'fijo',
};

// ── Screen ────────────────────────────────────────────────────────────────

export default function PuntosMarcajeScreen() {
  const { data: puntos = [], isLoading }   = usePuntosMarcaje();
  const crearMutation                      = useCrearPuntoMarcaje();
  const actualizarMutation                 = useActualizarPuntoMarcaje();
  const eliminarMutation                   = useEliminarPuntoMarcaje();

  const [modalVisible, setModalVisible]   = useState(false);
  const [editingPunto, setEditingPunto]   = useState<PuntoMarcaje | null>(null);
  const [form, setForm]                   = useState<FormState>(EMPTY_FORM);
  const [locating, setLocating]           = useState(false);

  const fijosPuntos  = puntos.filter((p) => p.tipo === 'fijo');
  const zonalesPuntos = puntos.filter((p) => p.tipo === 'zonal');

  function openCreate() {
    setEditingPunto(null);
    setForm(EMPTY_FORM);
    setModalVisible(true);
  }

  function openEdit(punto: PuntoMarcaje) {
    setEditingPunto(punto);
    setForm({
      nombre:       punto.nombre,
      descripcion:  punto.descripcion ?? '',
      latitud:      formatCoord(punto.latitud),
      longitud:     formatCoord(punto.longitud),
      radio_metros: String(punto.radio_metros),
      tipo:         punto.tipo,
    });
    setModalVisible(true);
  }

  async function handleUsarUbicacion() {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permiso denegado', 'La app necesita acceso a tu ubicación para autocompletar las coordenadas.');
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setForm((f) => ({
        ...f,
        latitud:  formatCoord(loc.coords.latitude),
        longitud: formatCoord(loc.coords.longitude),
      }));
    } catch {
      Alert.alert('Error', 'No se pudo obtener la ubicación. Ingresa las coordenadas manualmente.');
    } finally {
      setLocating(false);
    }
  }

  function handleGuardar() {
    const nombre  = form.nombre.trim();
    const lat     = parseFloat(form.latitud);
    const lng     = parseFloat(form.longitud);
    const radio   = parseInt(form.radio_metros, 10);

    if (!nombre) {
      Alert.alert('Campo requerido', 'El nombre del punto es obligatorio.');
      return;
    }
    if (isNaN(lat) || lat < -90 || lat > 90) {
      Alert.alert('Coordenada inválida', 'La latitud debe ser un número entre -90 y 90.');
      return;
    }
    if (isNaN(lng) || lng < -180 || lng > 180) {
      Alert.alert('Coordenada inválida', 'La longitud debe ser un número entre -180 y 180.');
      return;
    }
    if (isNaN(radio) || radio < 10 || radio > 5000) {
      Alert.alert('Radio inválido', 'El radio debe estar entre 10 y 5000 metros.');
      return;
    }

    if (editingPunto) {
      actualizarMutation.mutate(
        {
          id: editingPunto.id,
          payload: {
            nombre,
            descripcion:  form.descripcion.trim() || undefined,
            latitud:      lat,
            longitud:     lng,
            radio_metros: radio,
            tipo:         form.tipo,
          },
        },
        {
          onSuccess: () => setModalVisible(false),
          onError: (err: unknown) =>
            Alert.alert('Error', (err as ApiError).message ?? 'No se pudo actualizar.'),
        },
      );
    } else {
      crearMutation.mutate(
        {
          nombre,
          ...(form.descripcion.trim() ? { descripcion: form.descripcion.trim() } : {}),
          latitud:      lat,
          longitud:     lng,
          radio_metros: radio,
          tipo:         form.tipo,
        },
        {
          onSuccess: () => setModalVisible(false),
          onError: (err: unknown) =>
            Alert.alert('Error', (err as ApiError).message ?? 'No se pudo crear el punto.'),
        },
      );
    }
  }

  function handleEliminar(punto: PuntoMarcaje) {
    Alert.alert(
      'Eliminar punto',
      `¿Eliminar "${punto.nombre}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () =>
            eliminarMutation.mutate(punto.id, {
              onSuccess: () => {},
              onError: (err: unknown) => {
                const apiErr = err as ApiError;
                if (apiErr.status === 409) {
                  Alert.alert(
                    'Punto en uso',
                    apiErr.message ?? 'Este punto está asignado a uno o más cargos. Reasígnalos antes de eliminarlo.',
                  );
                } else {
                  Alert.alert('Error', apiErr.message ?? 'No se pudo eliminar.');
                }
              },
            }),
        },
      ],
    );
  }

  const isSaving = crearMutation.isPending || actualizarMutation.isPending;

  function PuntoCard({ punto }: { punto: PuntoMarcaje }) {
    const isZonal = punto.tipo === 'zonal';
    return (
      <View className="px-4 py-4 flex-row items-center gap-3">
        <View
          className="w-9 h-9 rounded-full items-center justify-center flex-shrink-0"
          style={{ backgroundColor: isZonal ? '#DBEAFE' : '#FEF3C7' }}
        >
          <Ionicons
            name="location-outline"
            size={16}
            color={isZonal ? COLORS.info : '#D97706'}
          />
        </View>

        <View className="flex-1 gap-0.5">
          <View className="flex-row items-center gap-2 flex-wrap">
            <Text className="text-sm font-semibold text-foreground">{punto.nombre}</Text>
            <View
              className="px-2 py-0.5 rounded-full"
              style={{ backgroundColor: isZonal ? '#DBEAFE' : '#FEF3C7' }}
            >
              <Text
                className="text-xs font-medium"
                style={{ color: isZonal ? COLORS.info : '#D97706' }}
              >
                {isZonal ? 'Zonal' : 'Fijo'}
              </Text>
            </View>
            {!punto.activo && (
              <View className="bg-danger/10 px-2 py-0.5 rounded-full">
                <Text className="text-xs text-danger">Inactivo</Text>
              </View>
            )}
          </View>

          {!!punto.descripcion && (
            <Text className="text-xs text-muted-foreground" numberOfLines={1}>
              {punto.descripcion}
            </Text>
          )}

          <Text className="text-xs text-muted-foreground">
            {formatCoord(punto.latitud)}, {formatCoord(punto.longitud)}
            {'  ·  '}Radio: {punto.radio_metros} m
          </Text>
        </View>

        <View className="flex-row items-center gap-1.5">
          <Pressable
            onPress={() => openEdit(punto)}
            hitSlop={8}
            className="w-8 h-8 rounded-full bg-muted items-center justify-center active:opacity-70"
          >
            <Ionicons name="pencil-outline" size={15} color="#64748B" />
          </Pressable>
          <Pressable
            onPress={() => handleEliminar(punto)}
            hitSlop={8}
            className="w-8 h-8 rounded-full bg-danger/10 items-center justify-center active:opacity-70"
            disabled={eliminarMutation.isPending}
          >
            <Ionicons name="trash-outline" size={15} color={COLORS.danger} />
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{ title: 'Puntos de marcaje', headerTintColor: COLORS.info }}
      />
      <SafeAreaView className="flex-1 bg-background" edges={['bottom']}>
        {isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color={COLORS.info} />
          </View>
        ) : (
          <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 96 }}>

            {/* Info */}
            <View className="bg-info/10 rounded-2xl p-4 mb-6 flex-row gap-3">
              <Ionicons name="information-circle-outline" size={18} color={COLORS.info} style={{ marginTop: 1 }} />
              <Text className="text-sm text-foreground flex-1">
                Los puntos <Text className="font-semibold">Fijo</Text> se asignan a un cargo específico. Los puntos <Text className="font-semibold">Zonal</Text> permiten marcar desde cualquier punto de la zona.
              </Text>
            </View>

            {/* Puntos fijos */}
            <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">
              Fijos ({fijosPuntos.length})
            </Text>
            {fijosPuntos.length === 0 ? (
              <View className="bg-card border border-dashed border-border rounded-2xl p-5 items-center gap-2 mb-6">
                <Ionicons name="location-outline" size={28} color="#94A3B8" />
                <Text className="text-sm text-muted-foreground text-center">
                  Sin puntos fijos. Crea uno con el botón +
                </Text>
              </View>
            ) : (
              <View className="bg-card border border-border rounded-2xl overflow-hidden mb-6">
                {fijosPuntos.map((p, idx) => (
                  <View key={p.id} className={idx < fijosPuntos.length - 1 ? 'border-b border-border' : ''}>
                    <PuntoCard punto={p} />
                  </View>
                ))}
              </View>
            )}

            {/* Puntos zonales */}
            <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">
              Zonales ({zonalesPuntos.length})
            </Text>
            {zonalesPuntos.length === 0 ? (
              <View className="bg-card border border-dashed border-border rounded-2xl p-5 items-center gap-2">
                <Ionicons name="map-outline" size={28} color="#94A3B8" />
                <Text className="text-sm text-muted-foreground text-center">
                  Sin puntos zonales. Los puntos zonales aceptan marcaje desde cualquiera de sus ubicaciones.
                </Text>
              </View>
            ) : (
              <View className="bg-card border border-border rounded-2xl overflow-hidden">
                {zonalesPuntos.map((p, idx) => (
                  <View key={p.id} className={idx < zonalesPuntos.length - 1 ? 'border-b border-border' : ''}>
                    <PuntoCard punto={p} />
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
                {editingPunto ? 'Editar punto' : 'Nuevo punto'}
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
                placeholder="Ej. Bodega principal"
                placeholderTextColor={COLORS.placeholder}
                className="px-4 h-14 text-base text-foreground"
                autoCorrect={false}
                autoFocus={!editingPunto}
              />
            </View>

            {/* Descripción */}
            <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2">
              Descripción{' '}
              <Text className="normal-case font-normal">(opcional)</Text>
            </Text>
            <View className="bg-card border border-border rounded-2xl overflow-hidden mb-4">
              <TextInput
                value={form.descripcion}
                onChangeText={(v) => setForm((f) => ({ ...f, descripcion: v }))}
                placeholder="Referencia del lugar…"
                placeholderTextColor={COLORS.placeholder}
                className="px-4 py-3 text-base text-foreground"
                multiline
                numberOfLines={2}
                style={{ minHeight: 56, textAlignVertical: 'top' }}
              />
            </View>

            {/* Coordenadas */}
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
                Coordenadas *
              </Text>
              <Pressable
                onPress={handleUsarUbicacion}
                disabled={locating}
                className="flex-row items-center gap-1.5 active:opacity-70"
              >
                {locating ? (
                  <ActivityIndicator size="small" color={COLORS.info} />
                ) : (
                  <Ionicons name="navigate-outline" size={14} color={COLORS.info} />
                )}
                <Text className="text-xs font-semibold text-info">
                  {locating ? 'Obteniendo…' : 'Usar mi ubicación'}
                </Text>
              </Pressable>
            </View>

            <View className="flex-row gap-3 mb-4">
              <View className="flex-1 bg-card border border-border rounded-2xl overflow-hidden">
                <TextInput
                  value={form.latitud}
                  onChangeText={(v) => setForm((f) => ({ ...f, latitud: v }))}
                  placeholder="Latitud"
                  placeholderTextColor={COLORS.placeholder}
                  className="px-4 h-14 text-base text-foreground"
                  keyboardType="decimal-pad"
                />
              </View>
              <View className="flex-1 bg-card border border-border rounded-2xl overflow-hidden">
                <TextInput
                  value={form.longitud}
                  onChangeText={(v) => setForm((f) => ({ ...f, longitud: v }))}
                  placeholder="Longitud"
                  placeholderTextColor={COLORS.placeholder}
                  className="px-4 h-14 text-base text-foreground"
                  keyboardType="decimal-pad"
                />
              </View>
            </View>

            {/* Radio */}
            <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2">
              Radio (metros)
            </Text>
            <View className="bg-card border border-border rounded-2xl overflow-hidden mb-4">
              <TextInput
                value={form.radio_metros}
                onChangeText={(v) => setForm((f) => ({ ...f, radio_metros: v }))}
                placeholder="100"
                placeholderTextColor={COLORS.placeholder}
                className="px-4 h-14 text-base text-foreground"
                keyboardType="number-pad"
              />
            </View>

            {/* Tipo */}
            <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">
              Tipo
            </Text>
            <View className="flex-row gap-3 mb-8">
              {(['fijo', 'zonal'] as const).map((opt) => {
                const active = form.tipo === opt;
                return (
                  <Pressable
                    key={opt}
                    onPress={() => setForm((f) => ({ ...f, tipo: opt }))}
                    className={`flex-1 py-3 rounded-xl border items-center active:opacity-70 ${
                      active ? 'border-info' : 'bg-card border-border'
                    }`}
                    style={active ? { backgroundColor: COLORS.info } : {}}
                  >
                    <Text
                      className={`text-sm font-semibold ${active ? 'text-white' : 'text-foreground'}`}
                    >
                      {opt === 'fijo' ? 'Fijo' : 'Zonal'}
                    </Text>
                    <Text
                      className={`text-xs mt-0.5 ${active ? 'text-white/80' : 'text-muted-foreground'}`}
                    >
                      {opt === 'fijo' ? 'Un cargo específico' : 'Cualquier trabajador'}
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
                  {editingPunto ? 'Guardar cambios' : 'Crear punto'}
                </Text>
              )}
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}
