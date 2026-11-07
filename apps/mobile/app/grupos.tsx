import React, { useState } from 'react';
import { FlatList, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { useRoleGuard } from '@/components/RoleGuard';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { SkeletonList } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { COLORS } from '@/lib/designTokens';
import { useOpcionesGrupos } from '@/features/empresas/useOpcionesGrupos';
import { EditarGrupoModal } from '@/features/grupos/EditarGrupoModal';
import { GrupoCard } from '@/features/grupos/GrupoCard';
import { TurnosDelGrupo } from '@/features/grupos/TurnosDelGrupo';
import { useGrupos } from '@/features/grupos/useGrupos';
import type { GrupoTurno } from '@api-client';

type Pestana = 'activo' | 'cerrado';
const PESTANAS: { key: Pestana; label: string }[] = [
  { key: 'activo', label: 'Activos' },
  { key: 'cerrado', label: 'Cerrados' },
];

/** Lista de grupos de turnos de la empresa: activos y cerrados. Solo para quien gestiona turnos. */
export default function GruposScreen() {
  const router = useRouter();
  const [pestana, setPestana] = useState<Pestana>('activo');
  const { usa, etiqueta, isLoading: cargandoOpciones } = useOpcionesGrupos();
  const [editando, setEditando] = useState<GrupoTurno | null>(null);
  // Grupos desplegados (se pueden ver varios a la vez).
  const [abiertos, setAbiertos] = useState<number[]>([]);
  const alternar = (id: number) => setAbiertos((a) => (a.includes(id) ? a.filter((x) => x !== id) : [...a, id]));
  const grupos = useGrupos(pestana, usa);
  const denied = useRoleGuard(['admin_empresa', 'jefe_turnos']);
  if (denied) return denied;

  const cuerpo = () => {
    if (cargandoOpciones || (usa && grupos.isLoading)) return <SkeletonList style={{ paddingHorizontal: 16, paddingTop: 12 }} />;
    if (!usa) {
      return <EmptyState title="Los grupos están apagados" message="Actívalos en Mi empresa para agrupar turnos de distintos días." />;
    }
    if (grupos.isError) return <ErrorState error={grupos.error} onRetry={grupos.refetch} fallback="No se pudieron cargar los grupos" />;
    return (
      <FlatList
        data={grupos.data ?? []}
        keyExtractor={(g) => String(g.id)}
        contentContainerStyle={{ padding: 16, paddingBottom: 96, gap: 12 }}
        renderItem={({ item }) => (
          <GrupoCard grupo={item} expandido={abiertos.includes(item.id)} onToggle={() => alternar(item.id)} onEditar={() => setEditando(item)}>
            <TurnosDelGrupo grupoId={item.id} estado={item.estado} />
          </GrupoCard>
        )}
        refreshing={grupos.isRefetching}
        onRefresh={() => grupos.refetch()}
        ListEmptyComponent={
          <EmptyState
            variant={pestana === 'activo' ? 'empty' : 'done'}
            title={pestana === 'activo' ? 'Todavía no hay nada' : 'Nada cerrado'}
            message={pestana === 'activo'
              ? 'Crea el grupo desde «Nuevo turno» y aparecerá aquí.'
              : 'Los grupos que cierres quedarán guardados aquí.'}
            action={pestana === 'activo' ? { label: 'Nuevo turno', onPress: () => router.push('/turno/nuevo') } : undefined}
          />
        }
      />
    );
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Grupos de turnos', headerTintColor: COLORS.primary }} />
      <SafeAreaView className="flex-1 bg-background" edges={['bottom']}>
        <View className="flex-row gap-2 px-4 pt-3">
          {PESTANAS.map((p) => (
            <Pressable
              key={p.key}
              onPress={() => setPestana(p.key)}
              accessibilityRole="tab"
              accessibilityState={{ selected: pestana === p.key }}
              className={`rounded-full px-4 py-2 border ${pestana === p.key ? 'bg-primary-500 border-primary-500' : 'bg-card border-border'}`}
            >
              <Text className={`text-sm font-semibold ${pestana === p.key ? 'text-white' : 'text-foreground'}`}>{p.label}</Text>
            </Pressable>
          ))}
        </View>
        {cuerpo()}
        {editando && <EditarGrupoModal visible grupo={editando} etiqueta={etiqueta} onClose={() => setEditando(null)} />}
      </SafeAreaView>
    </>
  );
}
