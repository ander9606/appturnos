import React, { useMemo, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { contratosApi } from '@api-client';
import { useTheme } from '@/lib/theme';
import { Badge } from '@/components/ui/Badge';
import { formatCOP } from '@/lib/formatters';
import type { ContratoResumen } from '@api-client';

export default function MisContratosScreen() {
  const router = useRouter();
  const theme  = useTheme();
  const { pendientes } = useLocalSearchParams<{ pendientes?: string }>();
  const [soloPendientes, setSoloPendientes] = useState(pendientes === '1');

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['mis-contratos'],
    queryFn: () => contratosApi.listar(),
    staleTime: 60_000,
  });

  const contratos = useMemo(() => {
    const todos = data ?? [];
    return soloPendientes ? todos.filter((c) => !c.firmado_trabajador) : todos;
  }, [data, soloPendientes]);
  const pendientesCount = useMemo(
    () => (data ?? []).filter((c) => !c.firmado_trabajador).length,
    [data]
  );

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['bottom']}>
      <View className="flex-row gap-2 px-5 pt-4 pb-1">
        {([
          { key: false, label: 'Todos' },
          { key: true, label: `Sin firmar${pendientesCount > 0 ? ` (${pendientesCount})` : ''}` },
        ] as const).map((f) => {
          const active = soloPendientes === f.key;
          return (
            <TouchableOpacity
              key={String(f.key)}
              onPress={() => setSoloPendientes(f.key)}
              className={`px-3 py-1.5 rounded-full border ${active ? 'border-transparent' : 'border-border'}`}
              style={active ? { backgroundColor: theme.primary } : undefined}
            >
              <Text className={`text-xs font-semibold ${active ? 'text-white' : 'text-muted-foreground'}`}>
                {f.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <FlatList
        data={contratos}
        keyExtractor={(c) => String(c.id)}
        contentContainerClassName="px-5 py-4 gap-3 pb-12"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch}
            tintColor={theme.primary} colors={[theme.primary]} />
        }
        ListEmptyComponent={
          isLoading ? (
            <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: 48 }} />
          ) : (
            <View className="items-center justify-center py-16 gap-3">
              <Ionicons name="document-text-outline" size={48} color="#94A3B8" />
              <Text className="text-base font-semibold text-foreground">
                {soloPendientes ? 'Sin contratos pendientes' : 'Sin contratos'}
              </Text>
              <Text className="text-sm text-muted-foreground text-center">
                {soloPendientes
                  ? 'Ya firmaste todos tus contratos.'
                  : 'Tus contratos de turno aparecerán aquí una vez seas asignado.'}
              </Text>
            </View>
          )
        }
        renderItem={({ item: c }) => <ContratoCard contrato={c} onPress={() => router.push(`/contrato/${c.id}`)} />}
      />
    </SafeAreaView>
  );
}

function ContratoCard({ contrato: c, onPress }: { contrato: ContratoResumen; onPress: () => void }) {
  const firmado = Boolean(c.firmado_trabajador);
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      className="bg-card border border-border rounded-2xl px-4 py-4 gap-2"
    >
      <View className="flex-row items-center justify-between">
        <Text className="text-sm font-bold text-foreground">{c.numero_contrato}</Text>
        <Badge label={firmado ? 'Firmado' : 'Sin firma'} variant={firmado ? 'success' : 'warning'} size="sm" />
      </View>
      <Text className="text-sm text-foreground">{c.oferta_titulo}</Text>
      <View className="flex-row items-center justify-between">
        <Text className="text-xs text-muted-foreground">{c.fecha} · {c.hora_inicio}–{c.hora_fin_estimada}</Text>
        <Text className="text-xs font-semibold text-foreground">{formatCOP(c.valor_dia)}</Text>
      </View>
      {!firmado && (
        <View className="flex-row items-center gap-1 mt-1">
          <Ionicons name="pencil-outline" size={12} color="#D97706" />
          <Text className="text-xs text-warning font-medium">Toca para firmar</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}
