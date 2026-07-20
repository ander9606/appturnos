/**
 * CargosCertificadosCard — gestiona los cargos certificados de un trabajador
 * ya activo (trabajador_empresa existe). Estos cargos son los que filtran
 * qué ofertas ve el trabajador (ofertas.model.js → listarMultiEmpresa).
 */
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Pressable, ActivityIndicator, Modal, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  useCargosTrabajador,
  useAsignarCargoTrabajador,
  useDesasignarCargoTrabajador,
} from './useEquipo';
import { useCargos } from '@/features/turnos/useTurnos';
import { confirm } from '@/lib/confirmDialog';
import type { ApiError } from '@api-client';

interface Props {
  trabajadorId: number;
  nombre: string;
}

export function CargosCertificadosCard({ trabajadorId, nombre }: Props) {
  const { data: certificados = [], isLoading } = useCargosTrabajador(trabajadorId);
  const { data: catalogo = [] } = useCargos();
  const asignar = useAsignarCargoTrabajador(trabajadorId);
  const desasignar = useDesasignarCargoTrabajador(trabajadorId);
  const [pickerVisible, setPickerVisible] = useState(false);

  const disponibles = catalogo.filter(
    (c) => c.activo && !certificados.some((cc) => cc.id === c.id)
  );

  async function handleQuitar(cargoId: number, cargoNombre: string) {
    const ok = await confirm({
      title: 'Quitar cargo',
      message: `${nombre} ya no verá ofertas para "${cargoNombre}". ¿Continuar?`,
      confirmLabel: 'Quitar',
      destructive: true,
    });
    if (!ok) return;
    desasignar.mutate(cargoId, {
      onError: (err: unknown) =>
        Alert.alert('Error', (err as ApiError)?.message ?? 'No se pudo quitar el cargo.'),
    });
  }

  function handleAgregar(cargoId: number) {
    setPickerVisible(false);
    asignar.mutate(cargoId, {
      onError: (err: unknown) =>
        Alert.alert('Error', (err as ApiError)?.message ?? 'No se pudo certificar el cargo.'),
    });
  }

  return (
    <View className="mx-4 mt-3 bg-card rounded-2xl border border-border p-4 gap-3">
      <View className="flex-row items-center justify-between">
        <Text className="text-sm font-semibold text-foreground">Cargos certificados</Text>
        <TouchableOpacity
          onPress={() => setPickerVisible(true)}
          className="flex-row items-center gap-1 px-2.5 py-1 bg-primary-50 rounded-lg"
        >
          <Ionicons name="add" size={14} color="#FF5A3C" />
          <Text className="text-xs font-semibold text-primary-500">Agregar</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <ActivityIndicator size="small" color="#FF5A3C" />
      ) : certificados.length === 0 ? (
        <Text className="text-xs text-muted-foreground">
          Sin cargos certificados — no verá ninguna oferta hasta que le asignes al menos uno.
        </Text>
      ) : (
        <View className="flex-row flex-wrap gap-2">
          {certificados.map((c) => (
            <View
              key={c.id}
              className="flex-row items-center gap-1.5 bg-primary-50 rounded-xl pl-3 pr-2 py-1.5"
            >
              <Text className="text-sm font-medium text-primary-700">{c.nombre}</Text>
              <Pressable
                onPress={() => handleQuitar(c.id, c.nombre)}
                hitSlop={8}
                disabled={desasignar.isPending}
              >
                <Ionicons name="close-circle" size={16} color="#FF5A3C" />
              </Pressable>
            </View>
          ))}
        </View>
      )}

      {/* Picker de cargos disponibles */}
      <Modal visible={pickerVisible} transparent animationType="slide" onRequestClose={() => setPickerVisible(false)}>
        <Pressable className="flex-1 bg-black/40" onPress={() => setPickerVisible(false)} />
        <View className="bg-background rounded-t-3xl px-5 pb-10 pt-4 gap-3" style={{ maxHeight: '70%' }}>
          <View className="w-10 h-1 bg-border rounded-full self-center mb-1" />
          <Text className="text-base font-bold text-foreground">Certificar cargo</Text>
          {disponibles.length === 0 ? (
            <View className="py-8 items-center gap-2">
              <Ionicons name="briefcase-outline" size={32} color="#94A3B8" />
              <Text className="text-sm text-muted-foreground text-center">
                {catalogo.length === 0
                  ? 'Tu empresa no tiene cargos creados todavía.'
                  : 'Ya está certificado para todos los cargos del catálogo.'}
              </Text>
            </View>
          ) : (
            disponibles.map((c) => (
              <TouchableOpacity
                key={c.id}
                onPress={() => handleAgregar(c.id)}
                disabled={asignar.isPending}
                className="flex-row items-center gap-3 px-4 py-3 rounded-2xl border bg-card border-border active:opacity-70"
              >
                <Ionicons name="briefcase-outline" size={18} color="#64748B" />
                <View className="flex-1">
                  <Text className="text-sm font-semibold text-foreground">{c.nombre}</Text>
                  {!!c.descripcion && (
                    <Text className="text-xs text-muted-foreground" numberOfLines={1}>{c.descripcion}</Text>
                  )}
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>
      </Modal>
    </View>
  );
}
