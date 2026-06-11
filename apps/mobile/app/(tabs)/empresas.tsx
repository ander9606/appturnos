import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  SectionList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { empresasApi } from '@api-client';
import type { Vinculo, EmpresaDirectorio } from '@api-client';
import { t } from '@/lib/i18n';
import {
  useMisEmpresas,
  useSolicitar,
  useAceptar,
  useRechazarVinculo,
} from '@/features/empresas/useTrabajadorEmpresa';
import { EmpresaCard } from '@/features/empresas/EmpresaCard';
import { VinculoCard } from '@/features/empresas/VinculoCard';

type ActiveTab = 'mis_empresas' | 'directorio';

// ── Mis empresas ──────────────────────────────────────────────────────────

function MisEmpresasView() {
  const { data, isLoading, isError, refetch, isRefetching } = useMisEmpresas();
  const { mutate: aceptar, isPending: aceptando, variables: aceptandoId } = useAceptar();
  const { mutate: rechazar, isPending: rechazando, variables: rechazandoVars } = useRechazarVinculo();

  const loadingId =
    (aceptando ? (aceptandoId as number) : null) ??
    (rechazando ? (rechazandoVars as { id: number })?.id : null);

  const sections = useMemo(() => {
    if (!data) return [];
    const result: Array<{ title: string; data: Vinculo[] }> = [];
    if (data.invitaciones.length > 0)
      result.push({ title: t('empresas.invitaciones'), data: data.invitaciones });
    if (data.activas.length > 0)
      result.push({ title: t('empresas.activas'), data: data.activas });
    if (data.pendientes.length > 0)
      result.push({ title: t('empresas.pendientes'), data: data.pendientes });
    return result;
  }, [data]);

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color="#FF5A3C" />
      </View>
    );
  }

  if (isError) {
    return (
      <View className="flex-1 items-center justify-center px-6">
        <Text className="text-danger text-center">{t('common.error')}</Text>
      </View>
    );
  }

  const totalVinculos =
    (data?.activas.length ?? 0) +
    (data?.pendientes.length ?? 0) +
    (data?.invitaciones.length ?? 0);

  if (totalVinculos === 0) {
    return (
      <View className="flex-1 items-center justify-center px-8">
        <Ionicons name="business-outline" size={48} color="#94A3B8" />
        <Text className="text-foreground font-semibold text-base mt-4 text-center">
          {t('empresas.misEmpresas')}
        </Text>
        <Text className="text-muted-foreground text-sm text-center mt-2">
          {t('empresas.emptyMisEmpresas')}
        </Text>
      </View>
    );
  }

  return (
    <SectionList
      sections={sections}
      keyExtractor={(item) => String(item.id)}
      contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 24 }}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#FF5A3C" />}
      renderSectionHeader={({ section: { title } }) => (
        <Text className="text-muted-foreground text-xs font-semibold uppercase tracking-wide mb-2 mt-4">
          {title}
        </Text>
      )}
      renderItem={({ item }) => (
        <VinculoCard
          vinculo={item}
          loadingId={loadingId}
          onAceptar={(id) => aceptar(id)}
          onRechazar={(id) => rechazar({ id })}
          onCancelar={(id) => rechazar({ id })}
        />
      )}
    />
  );
}

// ── Directorio ────────────────────────────────────────────────────────────

function DirectorioView() {
  const [busqueda, setBusqueda] = useState('');
  const [query, setQuery] = useState('');

  const { data: misEmpresas } = useMisEmpresas();
  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ['empresas-directorio', query],
    queryFn: () => empresasApi.directorio({ busqueda: query || undefined, limit: 50 }),
    staleTime: 60_000,
  });

  const { mutate: solicitar, isPending: solicitando, variables: solicitandoId } = useSolicitar();

  const vinculoMap = useMemo(() => {
    const map = new Map<number, 'activo' | 'pendiente' | 'invitacion'>();
    if (!misEmpresas) return map;
    misEmpresas.activas.forEach((v) => map.set(v.empresa_id, 'activo'));
    misEmpresas.invitaciones.forEach((v) => map.set(v.empresa_id, 'invitacion'));
    misEmpresas.pendientes.forEach((v) => map.set(v.empresa_id, 'pendiente'));
    return map;
  }, [misEmpresas]);

  const handleSearch = useCallback(() => setQuery(busqueda.trim()), [busqueda]);

  const empresas: EmpresaDirectorio[] = data?.data ?? [];

  return (
    <View className="flex-1">
      <View className="px-4 pt-3 pb-2">
        <View className="flex-row items-center bg-card border border-border rounded-xl px-3 gap-2">
          <Ionicons name="search-outline" size={18} color="#94A3B8" />
          <TextInput
            className="flex-1 py-3 text-sm text-foreground"
            placeholder="Buscar empresa…"
            placeholderTextColor="#94A3B8"
            value={busqueda}
            onChangeText={setBusqueda}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
          />
          {busqueda.length > 0 && (
            <Ionicons
              name="close-circle"
              size={18}
              color="#94A3B8"
              onPress={() => { setBusqueda(''); setQuery(''); }}
            />
          )}
        </View>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#FF5A3C" />
        </View>
      ) : isError ? (
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-danger text-center">{t('common.error')}</Text>
        </View>
      ) : empresas.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <Ionicons name="search-outline" size={48} color="#94A3B8" />
          <Text className="text-muted-foreground text-sm text-center mt-4">
            {t('empresas.emptyDirectorio')}
          </Text>
        </View>
      ) : (
        <FlatList
          data={empresas}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 24 }}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#FF5A3C" />}
          renderItem={({ item }) => (
            <EmpresaCard
              empresa={item}
              estadoVinculo={vinculoMap.get(item.id) ?? null}
              onSolicitar={() => solicitar(item.id)}
              solicitando={solicitando && solicitandoId === item.id}
            />
          )}
        />
      )}
    </View>
  );
}

// ── Pantalla principal ────────────────────────────────────────────────────

export default function EmpresasScreen() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('mis_empresas');

  const tabs: Array<{ key: ActiveTab; label: string }> = [
    { key: 'mis_empresas', label: t('empresas.misEmpresas') },
    { key: 'directorio',   label: t('empresas.directorio') },
  ];

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <View className="px-6 pt-4 pb-0 border-b border-border bg-background">
        <Text className="text-foreground text-xl font-bold mb-3">{t('tabs.empresas')}</Text>
        <View className="flex-row">
          {tabs.map(({ key, label }) => {
            const isActive = activeTab === key;
            return (
              <View
                key={key}
                onTouchEnd={() => setActiveTab(key)}
                className={`py-3 mr-6 border-b-2 ${isActive ? 'border-primary-500' : 'border-transparent'}`}
              >
                <Text className={`text-sm font-semibold ${isActive ? 'text-primary-500' : 'text-muted-foreground'}`}>
                  {label}
                </Text>
              </View>
            );
          })}
        </View>
      </View>

      {activeTab === 'mis_empresas' ? <MisEmpresasView /> : <DirectorioView />}
    </SafeAreaView>
  );
}
