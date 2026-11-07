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
import { coincideBusqueda, grupoEnPeriodo, periodoDeFecha, subtituloGrupo } from './grupoUtils';
import { bogotaToday, formatShortDate } from '@/lib/formatters';

type Props = {
  visible: boolean;
  /** Cómo llama la empresa a un grupo ("Evento", "Obra"…): va de título, sin artículo, para que sirva con cualquier nombre. */
  etiqueta: string;
  seleccionadoId?: number;
  /** Fecha del turno (YYYY-MM-DD): define el período de facturación que se muestra por defecto. Sin ella, hoy. */
  fecha?: string;
  onSelect: (g: GrupoTurno) => void;
  onCrear: () => void;
  onClose: () => void;
};

/** Con pocos grupos buscar estorba: el buscador aparece desde este número. */
const MIN_PARA_BUSCAR = 6;

/** Lista de grupos activos para vincular un turno. Los cerrados no aparecen: no reciben turnos nuevos. */
export function ElegirGrupoModal({ visible, etiqueta, seleccionadoId, fecha, onSelect, onCrear, onClose }: Props) {
  const [busqueda, setBusqueda] = useState('');
  const [verTodos, setVerTodos] = useState(false);
  const { data: grupos = [], isLoading, isError, error, refetch } = useGrupos('activo', visible);

  const periodo = useMemo(() => periodoDeFecha(fecha ?? bogotaToday()), [fecha]);
  const buscando = busqueda.trim() !== '';
  // Por defecto solo los grupos con turnos en el período: con cientos de grupos el resto es ruido. Buscar o «Ver todos» llega a cualquiera.
  const filtrados = useMemo(() => {
    if (buscando) return grupos.filter((g) => coincideBusqueda(g, busqueda));
    if (verTodos) return grupos;
    return grupos.filter((g) => grupoEnPeriodo(g, periodo) || g.id === seleccionadoId);
  }, [grupos, busqueda, buscando, verTodos, periodo, seleccionadoId]);
  const ocultos = grupos.length - filtrados.length;
  const cerrar = () => { setBusqueda(''); setVerTodos(false); onClose(); };

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

          {(grupos.length >= MIN_PARA_BUSCAR || ocultos > 0 || verTodos || buscando) && (
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

          {!buscando && !isLoading && !isError && (ocultos > 0 || verTodos) && (
            <TouchableOpacity
              onPress={() => setVerTodos((v) => !v)}
              accessibilityRole="button"
              accessibilityLabel={verTodos ? 'Ver solo este período' : `Ver todos (${grupos.length})`}
              className="mx-5 mb-2 flex-row items-center justify-between active:opacity-70"
            >
              <Text className="text-xs text-muted-foreground flex-1" numberOfLines={1}>
                {verTodos ? 'Mostrando todos' : `Con turnos del ${formatShortDate(periodo.desde)} al ${formatShortDate(periodo.hasta)}`}
              </Text>
              <Text className="text-xs font-semibold text-primary-600">{verTodos ? 'Solo este período' : `Ver todos (${grupos.length})`}</Text>
            </TouchableOpacity>
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
                ) : buscando ? (
                  <EmptyState compact variant="search" title="Sin resultados" />
                ) : (
                  <EmptyState compact title="Nada en este período" message="Usa «Ver todos» o el buscador para llegar a los demás." />
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
