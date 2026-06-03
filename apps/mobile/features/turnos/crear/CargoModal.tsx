import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  Modal,
  FlatList,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Cargo } from '@api-client';

type Props = {
  visible: boolean;
  cargos: Cargo[];
  usedIds: Set<number>;
  onSelect: (c: Cargo) => void;
  onClose: () => void;
};

export function CargoModal({ visible, cargos, usedIds, onSelect, onClose }: Props) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(
    () =>
      cargos.filter(
        (c) =>
          !usedIds.has(c.id) &&
          c.nombre.toLowerCase().includes(search.toLowerCase()),
      ),
    [cargos, usedIds, search],
  );

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View className="flex-1 bg-black/40 justify-end">
        <View className="bg-background rounded-t-3xl" style={{ maxHeight: '75%' }}>
          <View className="flex-row items-center justify-between px-5 pt-5 pb-3">
            <Text className="text-base font-bold text-foreground">Seleccionar rol</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#64748B" />
            </TouchableOpacity>
          </View>

          <View className="mx-5 mb-3 flex-row items-center bg-muted rounded-2xl px-3 gap-2">
            <Ionicons name="search-outline" size={16} color="#64748B" />
            <TextInput
              className="flex-1 py-3 text-sm text-foreground"
              placeholder="Buscar cargo…"
              placeholderTextColor="#94A3B8"
              value={search}
              onChangeText={setSearch}
            />
          </View>

          <FlatList
            data={filtered}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32 }}
            ItemSeparatorComponent={() => <View className="h-px bg-border" />}
            ListEmptyComponent={
              <Text className="text-sm text-muted-foreground text-center py-8">
                {usedIds.size === cargos.length ? 'Ya agregaste todos los cargos' : 'Sin resultados'}
              </Text>
            }
            renderItem={({ item }) => (
              <TouchableOpacity
                className="py-3.5 flex-row items-center gap-3"
                onPress={() => { onSelect(item); onClose(); setSearch(''); }}
              >
                <View className="w-8 h-8 bg-primary-100 rounded-xl items-center justify-center">
                  <Ionicons name="briefcase-outline" size={16} color="#FF5A3C" />
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-semibold text-foreground">{item.nombre}</Text>
                  {item.descripcion && (
                    <Text className="text-xs text-muted-foreground" numberOfLines={1}>
                      {item.descripcion}
                    </Text>
                  )}
                </View>
                <Ionicons name="chevron-forward" size={16} color="#94A3B8" />
              </TouchableOpacity>
            )}
          />
        </View>
      </View>
    </Modal>
  );
}
