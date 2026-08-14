import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useTrabajadores } from '@/features/equipo/useEquipo';
import type { DestinatarioInput } from './types';

type Props = {
  visible: boolean;
  seleccionados: DestinatarioInput[];
  onConfirm: (destinatarios: DestinatarioInput[]) => void;
  onClose: () => void;
};

export function TrabajadorPickerModal({ visible, seleccionados, onConfirm, onClose }: Props) {
  const [search, setSearch] = useState('');
  const [elegidos, setElegidos] = useState<DestinatarioInput[]>(seleccionados);

  // Vuelve a sincronizar con la selección del wizard cada vez que se reabre
  // (el modal queda montado entre aperturas, no se resetea solo).
  useEffect(() => {
    if (visible) setElegidos(seleccionados);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const { data, isLoading } = useTrabajadores({ activo: true, limit: 200, enabled: visible });

  const elegidoIds = useMemo(() => new Set(elegidos.map((d) => d.id)), [elegidos]);

  const filtrados = useMemo(() => {
    const trabajadores = data?.data ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return trabajadores;
    return trabajadores.filter(
      (t) =>
        `${t.nombre} ${t.apellido}`.toLowerCase().includes(q) ||
        (t.cedula ?? '').includes(q),
    );
  }, [data, search]);

  function toggle(id: number, nombre: string, apellido: string) {
    setElegidos((prev) =>
      prev.some((d) => d.id === id)
        ? prev.filter((d) => d.id !== id)
        : [...prev, { id, nombre, apellido }],
    );
  }

  function handleDone() {
    onConfirm(elegidos);
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View className="flex-1 bg-black/40 justify-end">
        <View className="bg-background rounded-t-3xl" style={{ maxHeight: '80%' }}>
          <View className="flex-row items-center justify-between px-5 pt-5 pb-3">
            <Text className="text-base font-bold text-foreground">Elegir personas</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#64748B" />
            </TouchableOpacity>
          </View>

          <View className="mx-5 mb-3 flex-row items-center bg-muted rounded-2xl px-3 gap-2">
            <Ionicons name="search-outline" size={16} color="#64748B" />
            <TextInput
              className="flex-1 py-3 text-sm text-foreground"
              placeholder="Buscar por nombre o cédula…"
              placeholderTextColor="#94A3B8"
              value={search}
              onChangeText={setSearch}
            />
          </View>

          {isLoading ? (
            <ActivityIndicator size="small" color="#FF5A3C" style={{ paddingVertical: 24 }} />
          ) : (
            <FlatList
              data={filtrados}
              keyExtractor={(item) => String(item.id)}
              contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 12 }}
              ItemSeparatorComponent={() => <View className="h-px bg-border" />}
              ListEmptyComponent={
                <Text className="text-sm text-muted-foreground text-center py-8">Sin resultados</Text>
              }
              renderItem={({ item }) => {
                const elegido = elegidoIds.has(item.id);
                return (
                  <TouchableOpacity
                    className="py-3.5 flex-row items-center gap-3"
                    onPress={() => toggle(item.id, item.nombre, item.apellido)}
                  >
                    <View
                      className={`w-5 h-5 rounded-full border items-center justify-center ${
                        elegido ? 'bg-primary border-primary' : 'border-border'
                      }`}
                    >
                      {elegido && <Ionicons name="checkmark" size={13} color="#FFFFFF" />}
                    </View>
                    <View className="flex-1">
                      <Text className="text-sm font-semibold text-foreground">
                        {item.nombre} {item.apellido}
                      </Text>
                      {item.cedula && (
                        <Text className="text-xs text-muted-foreground">{item.cedula}</Text>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              }}
            />
          )}

          <View className="px-5 pb-6 pt-2">
            <TouchableOpacity
              className="bg-primary rounded-2xl py-3.5 items-center"
              onPress={handleDone}
            >
              <Text className="text-white text-sm font-bold">
                Listo{elegidos.length > 0 ? ` (${elegidos.length})` : ''}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
