import React from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import type { EstadoGrupo } from '@api-client';
import { Button } from '@/components/ui/Button';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { FilaTurno } from './FilaTurno';
import { useGrupo } from './useGrupos';

/**
 * Lo que se despliega dentro de la tarjeta de un grupo: sus turnos por fecha (tocar uno abre el turno) y, si el grupo
 * sigue activo, «Agregar turno»; y «Abrir grupo» para duplicar o cerrar. Los turnos se piden al desplegar (no con la
 * lista) y comparten caché con el detalle del grupo.
 */
export function TurnosDelGrupo({ grupoId, estado }: { grupoId: number; estado: EstadoGrupo }) {
  const router = useRouter();
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
        <Text className="px-4 py-3 border-t border-border text-sm text-muted-foreground">Todavía no hay turnos en este grupo.</Text>
      ) : (
        data.turnos.map((t) => <FilaTurno key={t.id} turno={t} compacta onPress={() => router.push(`/oferta/${t.id}`)} />)
      )}
      <View className="flex-row gap-2 px-4 py-3 border-t border-border">
        {estado === 'activo' && (
          <Button
            label="Agregar turno"
            variant="secondary"
            size="sm"
            style={{ flex: 1 }}
            onPress={() => router.push({ pathname: '/turno/nuevo', params: { grupoId: String(grupoId) } })}
          />
        )}
        <Button label="Abrir grupo" variant="ghost" size="sm" style={{ flex: 1 }} onPress={() => router.push(`/grupo/${grupoId}`)} />
      </View>
    </View>
  );
}
