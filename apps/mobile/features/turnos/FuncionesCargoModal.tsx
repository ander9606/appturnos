/**
 * FuncionesCargoModal — ver (todos) / diligenciar (admin, jefe_turnos) el
 * listado de funciones que un cargo tiene en la empresa actual.
 */
import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, TextInput, Modal, FlatList, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { useFuncionesCargo, useActualizarFuncionesCargo } from './useTurnos';
import { COLORS } from '@/lib/designTokens';
import type { ApiError } from '@api-client';

interface Props {
  visible: boolean;
  onClose: () => void;
  cargoId: number | null;
  cargoNombre: string;
  /** true para admin_empresa/jefe_turnos: pueden agregar/quitar funciones. */
  editable?: boolean;
}

export function FuncionesCargoModal({ visible, onClose, cargoId, cargoNombre, editable = false }: Props) {
  const { data: funciones = [], isLoading } = useFuncionesCargo(cargoId, visible);
  const actualizar = useActualizarFuncionesCargo();

  const [items, setItems] = useState<string[]>([]);
  const [nuevo, setNuevo] = useState('');

  useEffect(() => {
    if (visible) setItems(funciones.map((f) => f.descripcion));
  }, [visible, funciones]);

  function agregar() {
    const v = nuevo.trim();
    if (!v) return;
    setItems((prev) => [...prev, v]);
    setNuevo('');
  }

  function quitar(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  function guardar() {
    if (!cargoId) return;
    actualizar.mutate(
      { cargoId, funciones: items },
      {
        onSuccess: onClose,
        onError: (err: unknown) =>
          Alert.alert('Error', (err as ApiError).message ?? 'No se pudieron guardar las funciones.'),
      },
    );
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView className="flex-1 bg-background" edges={['top', 'bottom']}>
        <View className="flex-row items-center justify-between px-5 py-4 border-b border-border">
          <View className="flex-1 pr-3">
            <Text className="text-base font-bold text-foreground">Funciones</Text>
            <Text className="text-xs text-muted-foreground" numberOfLines={1}>{cargoNombre}</Text>
          </View>
          <Pressable onPress={onClose} hitSlop={8}>
            <Ionicons name="close" size={24} color="#64748B" />
          </Pressable>
        </View>

        {isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color={COLORS.info} />
          </View>
        ) : (
          <FlatList
            data={items}
            keyExtractor={(_, i) => String(i)}
            contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
            renderItem={({ item, index }) => (
              <View className="flex-row items-center gap-3 bg-card border border-border rounded-2xl px-4 py-3 mb-2">
                <View className="w-6 h-6 rounded-full bg-info/10 items-center justify-center flex-shrink-0">
                  <Text className="text-xs font-semibold text-info">{index + 1}</Text>
                </View>
                <Text className="flex-1 text-sm text-foreground">{item}</Text>
                {editable && (
                  <Pressable onPress={() => quitar(index)} hitSlop={8}>
                    <Ionicons name="close-circle" size={18} color="#94A3B8" />
                  </Pressable>
                )}
              </View>
            )}
            ListEmptyComponent={
              <View className="items-center gap-2 py-12">
                <Ionicons name="list-outline" size={32} color="#94A3B8" />
                <Text className="text-sm text-muted-foreground text-center">
                  {editable
                    ? 'Aún no hay funciones registradas para este cargo.\nAgrega la primera abajo.'
                    : 'La empresa todavía no registró funciones para este cargo.'}
                </Text>
              </View>
            }
            ListFooterComponent={
              editable ? (
                <>
                  <View className="flex-row items-center gap-2 mt-2">
                    <View className="flex-1 bg-card border border-border rounded-2xl overflow-hidden">
                      <TextInput
                        value={nuevo}
                        onChangeText={setNuevo}
                        placeholder="Ej. Recibir y verificar mercancía"
                        placeholderTextColor={COLORS.placeholder}
                        className="px-4 h-12 text-sm text-foreground"
                        onSubmitEditing={agregar}
                        returnKeyType="done"
                      />
                    </View>
                    <Pressable
                      onPress={agregar}
                      className="w-12 h-12 rounded-2xl items-center justify-center active:opacity-80"
                      style={{ backgroundColor: COLORS.info }}
                    >
                      <Ionicons name="add" size={22} color="#fff" />
                    </Pressable>
                  </View>

                  <Pressable
                    onPress={guardar}
                    disabled={actualizar.isPending}
                    className="h-14 rounded-2xl items-center justify-center active:opacity-80 disabled:opacity-40 mt-6"
                    style={{ backgroundColor: COLORS.info }}
                  >
                    {actualizar.isPending ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text className="text-base font-semibold text-white">Guardar funciones</Text>
                    )}
                  </Pressable>
                </>
              ) : null
            }
          />
        )}
      </SafeAreaView>
    </Modal>
  );
}
