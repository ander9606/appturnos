import React, { useMemo, useState } from 'react';
import { Pressable, RefreshControl, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { useRoleGuard } from '@/components/RoleGuard';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { SkeletonList } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { COLORS } from '@/lib/designTokens';
import { bogotaToday } from '@/lib/formatters';
import { useTheme } from '@/lib/theme';
import { useOpcionesGrupos } from '@/features/empresas/useOpcionesGrupos';
import { MisGruposView } from '@/features/grupos/MisGruposView';
import { agruparMisTurnos, faseDeMiGrupo, soloConGrupo } from '@/features/grupos/misGrupos';
import { useMisTurnos } from '@/features/turnos/useTurnos';

type Pestana = 'pendientes' | 'terminados';

/**
 * «Mis eventos» (con el nombre que la empresa les puso): la vista propia del trabajador de sus turnos agrupados.
 * Dos pestañas: los que aún le faltan y los que ya terminó. Los turnos sueltos, sin grupo, se ven en la pestaña Turnos.
 */
export default function MisGruposScreen() {
  const theme = useTheme();
  const { etiqueta, etiquetaPlural } = useOpcionesGrupos();
  const turnos = useMisTurnos();
  const [pestana, setPestana] = useState<Pestana>('pendientes');
  const denied = useRoleGuard(['trabajador_turnos']);

  const { pendientes, terminados } = useMemo(() => {
    const hoy = bogotaToday();
    const todos = soloConGrupo(agruparMisTurnos(turnos.data ?? []));
    return {
      pendientes: todos.filter((g) => faseDeMiGrupo(g, hoy) !== 'terminado'),
      terminados: todos.filter((g) => faseDeMiGrupo(g, hoy) === 'terminado'),
    };
  }, [turnos.data]);
  if (denied) return denied;

  const plural = etiquetaPlural.toLowerCase();
  const PESTANAS: { key: Pestana; label: string; n: number }[] = [
    { key: 'pendientes', label: 'Por hacer', n: pendientes.length },
    { key: 'terminados', label: 'Terminados', n: terminados.length },
  ];
  const lista = pestana === 'pendientes' ? pendientes : terminados;
  const sinNada = pendientes.length + terminados.length === 0;

  const cuerpo = () => {
    if (turnos.isLoading) return <SkeletonList style={{ paddingHorizontal: 16, paddingTop: 12 }} />;
    if (turnos.isError) return <ErrorState error={turnos.error} onRetry={turnos.refetch} fallback="No se pudieron cargar tus turnos" />;
    return (
      <MisGruposView
        grupos={lista}
        refreshControl={<RefreshControl refreshing={turnos.isRefetching} onRefresh={() => turnos.refetch()} tintColor={theme.primary} colors={[theme.primary]} />}
        vacio={sinNada ? (
          <EmptyState title={`Todavía no tienes ${plural}`} message={`Cuando te asignen un turno que pertenezca a un ${etiqueta.toLowerCase()}, lo verás aquí. Tus demás turnos están en la pestaña Turnos.`} />
        ) : pestana === 'pendientes' ? (
          <EmptyState variant="done" title="Nada por hacer" message="Ya terminaste todos tus turnos de esta lista." />
        ) : (
          <EmptyState title="Nada terminado todavía" message="Aquí aparecerán cuando termines todos tus turnos." />
        )}
      />
    );
  };

  return (
    <>
      <Stack.Screen options={{ title: `Mis ${plural}`, headerTintColor: COLORS.primary }} />
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
              <Text className={`text-sm font-semibold ${pestana === p.key ? 'text-white' : 'text-foreground'}`}>
                {p.label}{turnos.data ? ` (${p.n})` : ''}
              </Text>
            </Pressable>
          ))}
        </View>
        {cuerpo()}
      </SafeAreaView>
    </>
  );
}
