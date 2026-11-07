import React from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import type { EstadoGrupo } from '@api-client';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '@/components/ui/Button';
import { COLORS } from '@/lib/designTokens';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { useOpcionesGrupos } from '@/features/empresas/useOpcionesGrupos';
import { FilaTurno } from './FilaTurno';
import { useGrupo } from './useGrupos';

/**
 * Lo que se despliega dentro de la tarjeta de un grupo: sus turnos por fecha (tocar uno abre el turno) y, si el grupo
 * sigue activo, «Agregar turno»; y «Abrir» (con el nombre de la empresa para sus grupos) para duplicar o cerrar. Los turnos se piden al desplegar (no con la
 * lista) y comparten caché con el detalle del grupo.
 */
export function TurnosDelGrupo({ grupoId, estado }: { grupoId: number; estado: EstadoGrupo }) {
  const router = useRouter();
  const { etiqueta } = useOpcionesGrupos();
  const { data, isLoading, isError, error, refetch } = useGrupo(grupoId);

  if (isLoading) {
    return (
      <View className="px-4 py-3 gap-2 border-t border-border" accessibilityLabel="Cargando turnos">
        <Skeleton height={14} width="40%" />
        <Skeleton height={16} width="75%" />
        <Skeleton height={12} width="55%" />
      </View>
    );
  }
  if (isError || !data) {
    return <View className="border-t border-border"><ErrorState compact error={error} onRetry={refetch} fallback="No se pudieron cargar los turnos" /></View>;
  }

  return (
    <View>
      {data.turnos.length === 0 ? (
        <Text className="px-4 py-3 border-t border-border text-sm text-muted-foreground">Todavía no hay turnos aquí.</Text>
      ) : (
        data.turnos.map((t) => <FilaTurno key={t.id} turno={t} compacta onPress={() => router.push(`/oferta/${t.id}`)} />)
      )}
      <View className="flex-row items-center justify-between gap-2 px-4 py-3 border-t border-border">
        <Button label={`Abrir ${etiqueta.toLowerCase()}`} variant="ghost" size="sm" onPress={() => router.push(`/grupo/${grupoId}`)} />
        {estado === 'activo' && (
          <Button
            label="Agregar turno"
            size="sm"
            icon={<Ionicons name="add" size={18} color={COLORS.white} />}
            onPress={() => router.push({ pathname: '/turno/nuevo', params: { grupoId: String(grupoId) } })}
          />
        )}
      </View>
    </View>
  );
}
