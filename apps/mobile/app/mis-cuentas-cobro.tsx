import { showAlert } from '@/lib/alertDialog';
import { Spinner } from '@/components/ui/Spinner';
import { COLORS } from '@/lib/designTokens';
import React, { useMemo, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, RefreshControl, } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { cuentasCobroApi } from '@api-client';
import { useTheme } from '@/lib/theme';
import { Badge } from '@/components/ui/Badge';
import { formatCOP } from '@/lib/formatters';
import { descargarCuentaCobro } from '@/features/nomina/descargarCuentaCobro';
import type { CuentaCobroResumen } from '@api-client';

export default function MisCuentasCobroScreen() {
  const router = useRouter();
  const theme  = useTheme();
  const { pendientes } = useLocalSearchParams<{ pendientes?: string }>();
  const [soloPendientes, setSoloPendientes] = useState(pendientes === '1');

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['mis-cuentas-cobro'],
    queryFn: () => cuentasCobroApi.listar(),
    staleTime: 60_000,
  });

  const cuentas = useMemo(() => {
    const todas = data ?? [];
    return soloPendientes ? todas.filter((c) => !c.firmado_trabajador) : todas;
  }, [data, soloPendientes]);
  const pendientesCount = useMemo(
    () => (data ?? []).filter((c) => !c.firmado_trabajador).length,
    [data]
  );

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['bottom']}>
      <View className="flex-row gap-2 px-5 pt-4 pb-1">
        {([
          { key: false, label: 'Todas' },
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
        data={cuentas}
        keyExtractor={(c) => String(c.id)}
        contentContainerClassName="px-5 py-4 gap-3 pb-12"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch}
            tintColor={theme.primary} colors={[theme.primary]} />
        }
        ListEmptyComponent={
          isLoading ? (
            <Spinner size="large" color={theme.primary} style={{ marginTop: 48 }} />
          ) : (
            <View className="items-center justify-center py-16 gap-3">
              <Ionicons name="document-text-outline" size={48} color={COLORS.placeholder} />
              <Text className="text-base font-semibold text-foreground">
                {soloPendientes ? 'Sin cuentas de cobro pendientes' : 'Sin cuentas de cobro'}
              </Text>
              <Text className="text-sm text-muted-foreground text-center">
                {soloPendientes
                  ? 'Ya firmaste todas tus cuentas de cobro.'
                  : 'Tus cuentas de cobro aparecerán aquí cuando se cierre un período con turnos tuyos.'}
              </Text>
            </View>
          )
        }
        renderItem={({ item: c }) => (
          <CuentaCobroCard cuenta={c} onPress={() => router.push(`/cuenta-cobro/${c.id}`)} />
        )}
      />
    </SafeAreaView>
  );
}

function CuentaCobroCard({ cuenta: c, onPress }: { cuenta: CuentaCobroResumen; onPress: () => void }) {
  const firmado = Boolean(c.firmado_trabajador);
  const [descargando, setDescargando] = useState(false);
  const descargar = async () => {
    setDescargando(true);
    try {
      await descargarCuentaCobro(c.id);
    } catch {
      showAlert('Error', 'No se pudo abrir el PDF. Intenta de nuevo.');
    } finally {
      setDescargando(false);
    }
  };
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      className="bg-card border border-border rounded-2xl px-4 py-4 gap-2"
    >
      <View className="flex-row items-center justify-between">
        <Text className="text-sm font-bold text-foreground">{c.numero_cuenta}</Text>
        <Badge label={firmado ? 'Firmado' : 'Sin firma'} variant={firmado ? 'success' : 'warning'} size="sm" />
      </View>
      <Text className="text-sm text-foreground">{c.fecha_inicio} a {c.fecha_fin}</Text>
      {c.secuencia > 1 && (
        <Text className="text-xs text-muted-foreground">Complementaria · diferencia de valores de turnos ya cobrados</Text>
      )}
      <View className="flex-row items-center justify-between">
        <Text className="text-xs text-muted-foreground">{c.total_turnos} turno{c.total_turnos !== 1 ? 's' : ''}</Text>
        <Text className="text-xs font-semibold text-foreground">{formatCOP(c.valor_total)}</Text>
      </View>
      <View className="flex-row items-center justify-between mt-1">
        {!firmado ? (
          <View className="flex-row items-center gap-1">
            <Ionicons name="pencil-outline" size={12} color={COLORS.warningDark} />
            <Text className="text-xs text-warning font-medium">Toca para firmar</Text>
          </View>
        ) : <View />}
        <TouchableOpacity
          onPress={descargar}
          disabled={descargando}
          hitSlop={8}
          accessibilityLabel={`Descargar PDF de la cuenta ${c.numero_cuenta}`}
          className="flex-row items-center gap-1"
        >
          {descargando
            ? <Spinner size="small" />
            : <Ionicons name="download-outline" size={14} color={COLORS.primary} />}
          <Text className="text-xs font-semibold" style={{ color: COLORS.primary }}>Descargar PDF</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}
