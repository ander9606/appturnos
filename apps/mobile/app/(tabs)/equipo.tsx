/**
 * Equipo tab — lista de trabajadores de la empresa.
 *
 * Visibilidad:
 *  - admin_empresa / jefe_turnos / jefe_nomina / nomina → pueden ver y filtrar
 *  - trabajador_turnos / trabajador_nomina → acceso denegado (pantalla vacía de cortesía)
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  Pressable,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuthStore } from '@/features/auth/useAuthStore';
import { useTrabajadores, useDesactivarTrabajador } from '@/features/equipo/useEquipo';
import { TrabajadorCard } from '@/features/equipo/TrabajadorCard';
import type { Trabajador, TipoTrabajador } from '@api-client';

// ── Constants ─────────────────────────────────────────────────────────────

const MANAGE_ROLES = ['admin_empresa', 'jefe_turnos', 'jefe_nomina', 'nomina'];

type Filtro = 'todos' | TipoTrabajador;

const FILTROS: { key: Filtro; label: string }[] = [
  { key: 'todos',  label: 'Todos'   },
  { key: 'turnos', label: 'Turnos'  },
  { key: 'nomina', label: 'Nómina'  },
  { key: 'ambos',  label: 'Ambos'   },
];

// ── Screen ────────────────────────────────────────────────────────────────

export default function EquipoScreen() {
  const usuario = useAuthStore((s) => s.usuario);
  const canManage = usuario != null && MANAGE_ROLES.includes(usuario.rol);
  const isAdmin   = usuario?.rol === 'admin_empresa';

  const [filtro, setFiltro]   = useState<Filtro>('todos');
  const [search, setSearch]   = useState('');

  const { data, isLoading, isError, refetch } = useTrabajadores({
    tipo:   filtro !== 'todos' ? filtro : undefined,
    activo: true,
  });

  const desactivar = useDesactivarTrabajador();

  // ── Acceso denegado ────────────────────────────────────────────────────

  if (!canManage) {
    return (
      <SafeAreaView
        className="flex-1 bg-background items-center justify-center px-8"
        edges={['top']}
      >
        <Text className="text-4xl mb-4">🔒</Text>
        <Text className="text-xl font-bold text-foreground text-center">
          Acceso restringido
        </Text>
        <Text className="text-sm text-muted-foreground text-center mt-2">
          No tienes permisos para ver la lista del equipo.
        </Text>
      </SafeAreaView>
    );
  }

  // ── Filtrado local por búsqueda ────────────────────────────────────────

  const term = search.trim().toLowerCase();
  const trabajadores = (data?.data ?? []).filter((t) => {
    if (!term) return true;
    return (
      t.nombre.toLowerCase().includes(term) ||
      t.apellido.toLowerCase().includes(term) ||
      (t.cedula?.toLowerCase().includes(term) ?? false) ||
      (t.email?.toLowerCase().includes(term) ?? false) ||
      (t.cargo?.toLowerCase().includes(term) ?? false)
    );
  });

  // ── Handlers ──────────────────────────────────────────────────────────

  function handleCardPress(t: Trabajador) {
    if (!isAdmin) return;
    Alert.alert(
      `${t.nombre} ${t.apellido}`,
      t.email ?? 'Sin correo',
      [
        {
          text: 'Desactivar',
          style: 'destructive',
          onPress: () =>
            Alert.alert(
              '¿Desactivar trabajador?',
              'El trabajador no podrá iniciar sesión ni recibir turnos.',
              [
                { text: 'Cancelar', style: 'cancel' },
                {
                  text: 'Desactivar',
                  style: 'destructive',
                  onPress: () =>
                    desactivar.mutate(t.id, {
                      onError: () =>
                        Alert.alert('Error', 'No se pudo desactivar. Intenta de nuevo.'),
                    }),
                },
              ],
            ),
        },
        { text: 'Cerrar', style: 'cancel' },
      ],
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────

  const total = data?.pagination?.total ?? 0;

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      {/* Header */}
      <View className="px-4 pt-4 pb-2">
        <Text className="text-2xl font-bold text-foreground">Equipo</Text>
        {!isLoading && (
          <Text className="text-sm text-muted-foreground">
            {total} {total === 1 ? 'trabajador' : 'trabajadores'}
          </Text>
        )}
      </View>

      {/* Search bar */}
      <View className="px-4 pb-3">
        <View className="flex-row items-center bg-card border border-border rounded-xl px-3 h-10">
          <Text className="text-muted-foreground mr-2">🔍</Text>
          <TextInput
            className="flex-1 text-sm text-foreground"
            placeholder="Buscar por nombre, cédula, cargo…"
            placeholderTextColor="#94A3B8"
            value={search}
            onChangeText={setSearch}
            autoCorrect={false}
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch('')} hitSlop={8}>
              <Text className="text-muted-foreground text-lg">×</Text>
            </Pressable>
          )}
        </View>
      </View>

      {/* Tipo filter pills */}
      <View className="flex-row gap-2 px-4 pb-3">
        {FILTROS.map(({ key, label }) => {
          const active = filtro === key;
          return (
            <Pressable
              key={key}
              onPress={() => setFiltro(key)}
              className={`rounded-full px-3 py-1.5 border ${
                active
                  ? 'bg-primary border-primary'
                  : 'bg-card border-border'
              }`}
            >
              <Text
                className={`text-xs font-semibold ${
                  active ? 'text-white' : 'text-muted-foreground'
                }`}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Content */}
      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#FF5A3C" />
        </View>
      ) : isError ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-4xl mb-3">⚠️</Text>
          <Text className="text-base font-semibold text-foreground">Error al cargar</Text>
          <Pressable onPress={() => refetch()} className="mt-4">
            <Text className="text-primary font-semibold">Reintentar</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={trabajadores}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
          renderItem={({ item }) => (
            <TrabajadorCard
              trabajador={item}
              onPress={isAdmin ? handleCardPress : undefined}
            />
          )}
          ListEmptyComponent={
            <View className="items-center justify-center py-16">
              <Text className="text-4xl mb-3">👥</Text>
              <Text className="text-base font-semibold text-foreground">
                {term ? 'Sin resultados' : 'Sin trabajadores'}
              </Text>
              <Text className="text-sm text-muted-foreground mt-1 text-center">
                {term
                  ? `No hay trabajadores que coincidan con "${term}".`
                  : 'No hay trabajadores registrados aún.'}
              </Text>
            </View>
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}
