import React, { useCallback, useState } from 'react';
import { View, ScrollView, FlatList, Pressable, Text } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/Button';
import { contratosApi, type ContratoSinFirmar, ApiError } from '@api-client';
import { QUERY_KEYS, ContratoFirmaModal } from '@/features/contratos';
import { showToast } from '@/lib/toast';
import { formatDate, formatTime, formatCOP } from '@/lib/formatters';

export default function ContratosPendientesScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const [firmandoContratoId, setFirmandoContratoId] = useState<number | null>(null);

  const { data: contratos = [], isLoading, error } = useQuery({
    queryKey: QUERY_KEYS.sinFirmar(),
    queryFn: () => contratosApi.listarSinFirmar(),
  });

  const handleVerTurno = useCallback(
    (asignacionId: number) => {
      router.push({ pathname: `/turno/[id]`, params: { id: asignacionId } });
    },
    [router]
  );

  const handleFirmaExitosa = useCallback(() => {
    setFirmandoContratoId(null);
    qc.invalidateQueries({ queryKey: QUERY_KEYS.sinFirmar() });
  }, [qc]);

  const renderContrato = ({ item }: { item: ContratoSinFirmar }) => (
    <Pressable
      onPress={() => handleVerTurno(item.asignacion_id)}
      className="bg-card border border-border rounded-lg p-4 mb-3 active:opacity-70"
    >
      <View className="flex-row justify-between items-start mb-2">
        <View className="flex-1">
          <Text className="text-base font-bold text-foreground">
            {item.oferta_titulo}
          </Text>
          <Text className="text-xs text-muted-foreground mt-1">
            {item.numero_contrato}
          </Text>
        </View>
        <View className="bg-primary px-3 py-1 rounded">
          <Text className="text-xs font-bold text-primary-foreground">
            {item.tipo_contrato === 'LABORAL' ? 'Laboral' : 'Prestación'}
          </Text>
        </View>
      </View>

      <View className="bg-background rounded p-3 mb-3">
        <View className="mb-2">
          <Text className="text-xs text-muted-foreground">
            Fecha y Horario
          </Text>
          <Text className="text-sm text-foreground mt-1">
            {formatDate(item.fecha)} · {formatTime(item.hora_inicio)} - {formatTime(item.hora_fin_estimada)}
          </Text>
        </View>

        <View className="mb-2">
          <Text className="text-xs text-muted-foreground">
            Ubicación
          </Text>
          <Text className="text-sm text-foreground mt-1">
            {item.lugar}
          </Text>
        </View>

        <View>
          <Text className="text-xs text-muted-foreground">
            Labor
          </Text>
          <Text className="text-sm text-foreground mt-1">
            {item.descripcion_labor}
          </Text>
        </View>
      </View>

      <View className="flex-row justify-between items-end">
        <View>
          <Text className="text-xs text-muted-foreground">
            Valor del Día
          </Text>
          <Text className="text-base font-bold text-success mt-1">
            {formatCOP(item.valor_dia)}
          </Text>
        </View>
        <Button
          label="Firmar"
          variant="primary"
          size="sm"
          onPress={() => setFirmandoContratoId(item.id)}
        />
      </View>
    </Pressable>
  );

  const emptyComponent = (
    <View className="flex-1 justify-center items-center py-12">
      <Text className="text-base text-muted-foreground text-center">
        ✓ No tienes contratos pendientes
      </Text>
      <Text className="text-xs text-muted-foreground text-center mt-2">
        Todos tus contratos están firmados
      </Text>
    </View>
  );

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Contratos Pendientes',
          headerShown: true,
        }}
      />

      <View className="flex-1 bg-background">
        {error && (
          <View className="p-4 bg-danger/10 border border-danger rounded-lg m-4">
            <Text className="text-sm text-danger">
              {error instanceof ApiError ? error.message : 'Error cargando contratos'}
            </Text>
          </View>
        )}

        <FlatList
          data={contratos}
          renderItem={renderContrato}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={{ padding: 16, flexGrow: 1 }}
          scrollEnabled={true}
          ListEmptyComponent={!isLoading ? emptyComponent : null}
        />

        {contratos.length > 0 && (
          <View className="p-4 bg-info/10 border-t border-border">
            <Text className="text-xs text-info text-center">
              Tienes {contratos.length} contrato{contratos.length !== 1 ? 's' : ''} para firmar
            </Text>
          </View>
        )}
      </View>

      <ContratoFirmaModal
        visible={firmandoContratoId !== null}
        contratoId={firmandoContratoId}
        onClose={() => setFirmandoContratoId(null)}
        onSuccess={handleFirmaExitosa}
      />
    </>
  );
}
