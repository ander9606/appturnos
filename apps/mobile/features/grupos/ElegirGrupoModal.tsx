import React, { useMemo, useState } from 'react';
import { View, Modal, FlatList, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { GrupoTurno } from '@api-client';
import { Text, TextInput } from '@/components/ui/Text';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { SkeletonList } from '@/components/ui/Skeleton';
import { COLORS } from '@/lib/designTokens';
import { useGrupos } from './useGrupos';
import { subtituloGrupo } from './grupoUtils';

type Props = {
  visible: boolean;
  /** Cómo llama la empresa a un grupo ("Evento", "Obra"…): va de título, sin artículo, para que sirva con cualquier nombre. */
  etiqueta: string;
  seleccionadoId?: number;
  onSelect: (g: GrupoTurno) => void;
  onCrear: () => void;
  onClose: () => void;
};

/** Con pocos grupos buscar estorba: el buscador aparece desde este número. */
const MIN_PARA_BUSCAR = 6;

/** Lista de grupos activos para vincular un turno. Los cerrados no aparecen: no reciben turnos nuevos. */
export function ElegirGrupoModal({ visible, etiqueta, seleccionadoId, onSelect, onCrear, onClose }: Props) {
  const [busqueda, setBusqueda] = useState('');
  const { data: grupos = [], isLoading, isError, error, refetch } = useGrupos('activo', visible);

  const filtrados = useMemo(
    () => grupos.filter((g) => g.nombre.toLowerCase().includes(busqueda.trim().toLowerCase())),
    [grupos, busqueda],
  );
  const cerrar = () => { setBusqueda(''); onClose(); };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={cerrar}>
      <View className="flex-1 bg-black/40 justify-end">
        <View className="bg-background rounded-t-3xl" style={{ maxHeight: '75%' }}>
          <View className="flex-row items-center justify-between px-5 pt-5 pb-3">
            <Text className="text-base font-bold text-foreground">{etiqueta}</Text>
            <TouchableOpacity onPress={cerrar} accessibilityRole="button" accessibilityLabel="Cerrar">
              <Ionicons name="close" size={24} color={COLORS.mutedForeground} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            onPress={() => { setBusqueda(''); onCrear(); }}
            accessibilityRole="button"
            accessibilityLabel={`Crear ${etiqueta}`}
            className="mx-5 mb-3 flex-row items-center gap-3 bg-primary-50 border border-primary-200 rounded-2xl px-4 py-3 active:opacity-70"
          >
            <Ionicons name="add-circle" size={20} color={COLORS.primary} />
            <Text className="text-sm font-semibold text-primary-600 flex-1">Crear</Text>
          </TouchableOpacity>

          {grupos.length >= MIN_PARA_BUSCAR && (
            <View className="mx-5 mb-3 flex-row items-center bg-muted rounded-2xl px-3 gap-2">
              <Ionicons name="search-outline" size={16} color={COLORS.mutedForeground} />
              <TextInput
                className="flex-1 py-3 text-sm text-foreground"
                placeholder="Buscar…"
                placeholderTextColor={COLORS.placeholder}
                value={busqueda}
                onChangeText={setBusqueda}
              />
            </View>
          )}

          {isLoading ? (
            <SkeletonList count={3} style={{ paddingHorizontal: 20, paddingBottom: 32 }} />
          ) : isError ? (
            <ErrorState compact error={error} onRetry={refetch} fallback="No se pudo cargar la lista" />
          ) : (
            <FlatList
              data={filtrados}
              keyExtractor={(g) => String(g.id)}
              contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32 }}
              ItemSeparatorComponent={() => <View className="h-px bg-border" />}
              ListEmptyComponent={
                grupos.length === 0 ? (
                  <EmptyState compact title="Todavía no hay nada" message="Usa «Crear» para empezar." />
                ) : (
                  <EmptyState compact variant="search" title="Sin resultados" />
                )
              }
              renderItem={({ item }) => {
                const activo = item.id === seleccionadoId;
                return (
                  <TouchableOpacity
                    className="py-3.5 flex-row items-center gap-3"
                    accessibilityRole="button"
                    accessibilityLabel={`${item.nombre}. ${subtituloGrupo(item)}`}
                    accessibilityState={{ selected: activo }}
                    onPress={() => { setBusqueda(''); onSelect(item); }}
                  >
                    <View className="w-8 h-8 bg-primary-100 rounded-xl items-center justify-center">
                      <Ionicons name="albums-outline" size={16} color={COLORS.primary} />
                    </View>
                    <View className="flex-1">
                      <Text className="text-sm font-semibold text-foreground" numberOfLines={1}>{item.nombre}</Text>
                      <Text className="text-xs text-muted-foreground" numberOfLines={1}>{subtituloGrupo(item)}</Text>
                    </View>
                    {activo && <Ionicons name="checkmark-circle" size={18} color={COLORS.primary} />}
                  </TouchableOpacity>
                );
              }}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}
