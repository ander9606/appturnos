/**
 * AsignacionesLugar — gestión de tipo de marcación y punto geofence
 * por trabajador de nómina (admin_empresa / jefe_nomina).
 *
 * Libre  → el trabajador puede marcar desde cualquier coordenada.
 * Fijo   → debe estar dentro del radio del punto_marcaje asignado.
 */

import React, { useState } from 'react';
import {
  View, Text, FlatList, ActivityIndicator,
  TouchableOpacity, Modal, Pressable,
  RefreshControl, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '@/lib/theme';
import { getInitials } from '@/lib/formatters';
import { useTrabajadores, useActualizarMarcacion } from '@/features/equipo/useEquipo';
import { usePuntosMarcaje } from '@/features/turnos/usePuntosMarcaje';
import type { Trabajador, PuntoMarcaje } from '@api-client';

// ── Fila de trabajador ────────────────────────────────────────────────────────

function FilaTrabajador({
  t,
  puntos,
}: {
  t: Trabajador;
  puntos: PuntoMarcaje[];
}) {
  const { mutate, isPending } = useActualizarMarcacion();
  const [showPuntos, setShowPuntos] = useState(false);

  const esFijo   = t.tipo_marcacion === 'fijo';
  const puntoActual = puntos.find((p) => p.id === t.punto_marcaje_id);

  function toggleTipo() {
    if (esFijo) {
      Alert.alert(
        'Cambiar a libre',
        `¿${t.nombre} ${t.apellido} podrá marcar desde cualquier ubicación?`,
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Confirmar', onPress: () => mutate({ id: t.id, tipo_marcacion: 'libre', punto_marcaje_id: null }) },
        ]
      );
    } else {
      // pasar a fijo requiere elegir un punto
      setShowPuntos(true);
    }
  }

  function asignarPunto(p: PuntoMarcaje) {
    setShowPuntos(false);
    mutate({ id: t.id, tipo_marcacion: 'fijo', punto_marcaje_id: p.id });
  }

  function cambiarPunto() {
    setShowPuntos(true);
  }

  return (
    <>
      <View
        className="bg-card rounded-2xl px-4 py-3 flex-row items-center gap-3"
        style={{ elevation: 1, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6 }}
      >
        {/* Avatar */}
        <View className="w-10 h-10 rounded-full bg-primary/10 items-center justify-center flex-shrink-0">
          <Text className="text-sm font-bold text-primary">
            {getInitials(t.nombre, t.apellido)}
          </Text>
        </View>

        {/* Info */}
        <View className="flex-1 gap-0.5">
          <Text className="text-sm font-semibold text-foreground" numberOfLines={1}>
            {t.nombre} {t.apellido}
          </Text>
          {esFijo && puntoActual ? (
            <TouchableOpacity onPress={cambiarPunto} className="flex-row items-center gap-1">
              <Ionicons name="location-outline" size={11} color="#6366F1" />
              <Text className="text-xs text-primary" numberOfLines={1}>{puntoActual.nombre}</Text>
              <Ionicons name="pencil-outline" size={10} color="#6366F1" />
            </TouchableOpacity>
          ) : esFijo ? (
            <Text className="text-xs text-danger">Sin punto asignado</Text>
          ) : (
            <Text className="text-xs text-muted-foreground">Sin restricción de ubicación</Text>
          )}
        </View>

        {/* Toggle tipo */}
        <TouchableOpacity
          onPress={isPending ? undefined : toggleTipo}
          disabled={isPending}
          className={[
            'px-3 py-1.5 rounded-full',
            esFijo ? 'bg-primary/10' : 'bg-muted',
          ].join(' ')}
        >
          {isPending ? (
            <ActivityIndicator size="small" color="#6366F1" />
          ) : (
            <Text className={`text-xs font-semibold ${esFijo ? 'text-primary' : 'text-muted-foreground'}`}>
              {esFijo ? 'Fijo' : 'Libre'}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Modal selector de punto */}
      <Modal visible={showPuntos} transparent animationType="slide" onRequestClose={() => setShowPuntos(false)}>
        <Pressable className="flex-1 bg-black/40" onPress={() => setShowPuntos(false)} />
        <View className="bg-background rounded-t-3xl px-5 pb-10 pt-4 gap-3">
          <View className="w-10 h-1 bg-border rounded-full self-center mb-1" />
          <Text className="text-base font-bold text-foreground">
            Seleccionar punto — {t.nombre}
          </Text>
          {puntos.length === 0 ? (
            <View className="py-8 items-center gap-2">
              <Ionicons name="location-outline" size={32} color="#94A3B8" />
              <Text className="text-sm text-muted-foreground text-center">
                No hay puntos de marcaje configurados.{'\n'}Créalos en la sección de Empresa.
              </Text>
            </View>
          ) : (
            puntos.map((p) => (
              <TouchableOpacity
                key={p.id}
                onPress={() => asignarPunto(p)}
                className={[
                  'flex-row items-center gap-3 px-4 py-3 rounded-2xl border',
                  p.id === t.punto_marcaje_id ? 'bg-primary/5 border-primary' : 'bg-card border-border',
                ].join(' ')}
              >
                <Ionicons
                  name={p.tipo === 'fijo' ? 'location' : 'radio-button-on'}
                  size={18}
                  color={p.id === t.punto_marcaje_id ? '#6366F1' : '#64748B'}
                />
                <View className="flex-1">
                  <Text className={`text-sm font-semibold ${p.id === t.punto_marcaje_id ? 'text-primary' : 'text-foreground'}`}>
                    {p.nombre}
                  </Text>
                  <Text className="text-xs text-muted-foreground">Radio {p.radio_metros} m</Text>
                </View>
                {p.id === t.punto_marcaje_id && (
                  <Ionicons name="checkmark-circle" size={18} color="#6366F1" />
                )}
              </TouchableOpacity>
            ))
          )}
        </View>
      </Modal>
    </>
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
  const libres = trabajadores.filter((t) => t.tipo_marcacion !== 'fijo').length;

  const isLoading = loadingT || loadingP;
  const onRefresh = () => { refetchT(); refetchP(); };

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
                    <View className="w-1.5 h-1.5 rounded-full bg-white/40" />
                    <Text className="text-white/80 text-xs">{libres} libre{libres !== 1 ? 's' : ''}</Text>
                  </View>
                </View>
              </View>

              <View className="bg-muted rounded-xl px-4 py-2.5 flex-row items-start gap-2">
                <Ionicons name="information-circle-outline" size={14} color="#64748B" className="mt-0.5" />
                <Text className="text-xs text-muted-foreground flex-1">
                  <Text className="font-semibold">Fijo</Text>: el trabajador debe estar dentro del radio del punto para marcar.{' '}
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
