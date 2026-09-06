import React, { useCallback } from 'react';
import { View, ScrollView, FlatList, Pressable } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Text } from '@/components/Text';
import { Button } from '@/components/Button';
import { contratosApi, type ContratoSinFirmar, ApiError } from '@api-client';
import { QUERY_KEYS } from '@/features/contratos';
import { showToast } from '@/lib/toast';
import { formatDate, formatTime, formatCurrency } from '@/lib/formatters';

export default function ContratosPendientesScreen() {
  const router = useRouter();
  const qc = useQueryClient();

  const { data: contratos = [], isLoading, error } = useQuery({
    queryKey: QUERY_KEYS.sinFirmar(),
    queryFn: () => contratosApi.listarSinFirmar(),
  });

  const handleFirmarContrato = useCallback(
    async (contratoId: number, asignacionId: number) => {
      router.push({
        pathname: `/turno/[id]`,
        params: { id: asignacionId, contratoId },
      });
    },
    [router]
  );

  const renderContrato = ({ item }: { item: ContratoSinFirmar }) => (
    <Pressable
      onPress={() => handleFirmarContrato(item.id, item.asignacion_id)}
      className="bg-card border border-border rounded-lg p-4 mb-3 active:opacity-70"
    >
      <View className="flex-row justify-between items-start mb-2">
        <View className="flex-1">
          <Text variant="body-bold" className="text-foreground">
            {item.oferta_titulo}
          </Text>
          <Text variant="caption" className="text-muted-foreground mt-1">
            {item.numero_contrato}
          </Text>
        </View>
        <View className="bg-primary px-3 py-1 rounded">
          <Text variant="caption-bold" className="text-primary-foreground">
            {item.tipo_contrato === 'LABORAL' ? 'Laboral' : 'Prestación'}
          </Text>
        </View>
      </View>

      <View className="bg-background rounded p-3 mb-3">
        <View className="mb-2">
          <Text variant="caption" className="text-muted-foreground">
            Fecha y Horario
          </Text>
          <Text variant="body-sm" className="text-foreground mt-1">
            {formatDate(item.fecha)} · {formatTime(item.hora_inicio)} - {formatTime(item.hora_fin_estimada)}
          </Text>
        </View>

        <View className="mb-2">
          <Text variant="caption" className="text-muted-foreground">
            Ubicación
          </Text>
          <Text variant="body-sm" className="text-foreground mt-1">
            {item.lugar}
          </Text>
        </View>

        <View>
          <Text variant="caption" className="text-muted-foreground">
            Labor
          </Text>
          <Text variant="body-sm" className="text-foreground mt-1">
            {item.descripcion_labor}
          </Text>
        </View>
      </View>

      <View className="flex-row justify-between items-end">
        <View>
          <Text variant="caption" className="text-muted-foreground">
            Valor del Día
          </Text>
          <Text variant="body-bold" className="text-success mt-1">
            {formatCurrency(item.valor_dia)}
          </Text>
        </View>
        <Button
          label="Firmar"
          variant="primary"
          size="sm"
          onPress={() => handleFirmarContrato(item.id, item.asignacion_id)}
        />
      </View>
    </Pressable>
  );

  const emptyComponent = (
    <View className="flex-1 justify-center items-center py-12">
      <Text variant="body" className="text-muted-foreground text-center">
        ✓ No tienes contratos pendientes
      </Text>
      <Text variant="caption" className="text-muted-foreground text-center mt-2">
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
            <Text variant="body-sm" className="text-danger">
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
            <Text variant="caption" className="text-info text-center">
              Tienes {contratos.length} contrato{contratos.length !== 1 ? 's' : ''} para firmar
            </Text>
          </View>
        )}
      </View>
    </>
  );
}
