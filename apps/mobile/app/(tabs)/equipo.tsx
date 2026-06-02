/**
 * Equipo tab — lista de trabajadores de la empresa.
 *
 * Visibilidad:
 *  - admin_empresa / jefe_turnos / jefe_nomina / nomina → pueden ver y filtrar
 *  - trabajador_turnos / trabajador_nomina → acceso denegado (pantalla de cortesía)
 *
 * Solo admin_empresa:
 *  - FAB "+" para crear nuevo trabajador
 *  - Navegar al detalle con opciones de editar / desactivar
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { Ionicons } from '@expo/vector-icons';

import { useAuthStore } from '@/features/auth/useAuthStore';
import { useTrabajadores } from '@/features/equipo/useEquipo';
import { COLORS } from '@/lib/designTokens';
import { TrabajadorCard } from '@/features/equipo/TrabajadorCard';
import type { Trabajador, TipoTrabajador } from '@api-client';

// ── Constants ─────────────────────────────────────────────────────────────

const MANAGE_ROLES = ['admin_empresa', 'jefe_turnos', 'jefe_nomina', 'nomina'];

type Filtro = 'todos' | TipoTrabajador;

const FILTROS: { key: Filtro; label: string }[] = [
  { key: 'todos',  label: 'Todos'  },
  { key: 'turnos', label: 'Turnos' },
  { key: 'nomina', label: 'Nómina' },
  { key: 'ambos',  label: 'Ambos'  },
];

// ── Screen ────────────────────────────────────────────────────────────────

export default function EquipoScreen() {
  const router  = useRouter();
  const usuario = useAuthStore((s) => s.usuario);
  const canManage = usuario != null && MANAGE_ROLES.includes(usuario.rol);
  const isAdmin   = usuario?.rol === 'admin_empresa';

  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [search, setSearch] = useState('');
  const [showInactive, setShowInactive] = useState(false);

  const { data, isLoading, isError, refetch } = useTrabajadores({
    tipo:   filtro !== 'todos' ? filtro : undefined,
    activo: showInactive ? undefined : true,
  });

  // ── Acceso denegado ────────────────────────────────────────────────────

  if (!canManage) {
    return (
      <SafeAreaView
        className="flex-1 bg-background items-center justify-center px-8"
        edges={['top']}
      >
        <Ionicons name="lock-closed-outline" size={48} color="#94A3B8" style={{ marginBottom: 16 }} />
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

  const total = data?.pagination?.total ?? 0;

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      {/* Header */}
      <View className="px-4 pt-4 pb-2 flex-row items-start justify-between">
        <View>
          <Text className="text-2xl font-bold text-foreground">Equipo</Text>
          {!isLoading && (
            <Text className="text-sm text-muted-foreground">
              {total} {total === 1 ? 'trabajador' : 'trabajadores'}
            </Text>
          )}
        </View>
        {/* Toggle inactivos */}
        <Pressable
          onPress={() => setShowInactive((v) => !v)}
          className={`rounded-full px-3 py-1.5 border mt-1 ${
            showInactive ? 'bg-danger/10 border-danger' : 'bg-card border-border'
          }`}
        >
          <Text
            className={`text-xs font-semibold ${
              showInactive ? 'text-danger' : 'text-muted-foreground'
            }`}
          >
            {showInactive ? 'Mostrando inactivos' : 'Solo activos'}
          </Text>
        </Pressable>
      </View>

      {/* Search bar */}
      <View className="px-4 pb-3">
        <View className="flex-row items-center bg-card border border-border rounded-xl px-3 h-10">
          <Ionicons name="search-outline" size={16} color="#64748B" style={{ marginRight: 8 }} />
          <TextInput
            className="flex-1 text-sm text-foreground"
            placeholder="Nombre, cédula, cargo…"
            placeholderTextColor={COLORS.placeholder}
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
                active ? 'bg-primary border-primary' : 'bg-card border-border'
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

      {/* List */}
      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#FF5A3C" />
        </View>
      ) : isError ? (
        <View className="flex-1 items-center justify-center px-8">
          <Ionicons name="warning-outline" size={48} color="#94A3B8" style={{ marginBottom: 12 }} />
          <Text className="text-base font-semibold text-foreground">Error al cargar</Text>
          <Pressable onPress={() => refetch()} className="mt-4">
            <Text className="text-primary font-semibold">Reintentar</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={trabajadores}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}
          renderItem={({ item }: { item: Trabajador }) => (
            <TrabajadorCard
              trabajador={item}
              onPress={(t) => router.push(`/trabajador/${t.id}`)}
            />
          )}
          ListEmptyComponent={
            <View className="items-center justify-center py-16">
              <Ionicons name="people-outline" size={48} color="#94A3B8" style={{ marginBottom: 12 }} />
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

      {/* FAB — solo admin */}
      {isAdmin && (
        <Pressable
          onPress={() => router.push('/trabajador/nuevo')}
          className="absolute bottom-6 right-6 w-14 h-14 rounded-full bg-primary items-center justify-center shadow-lg active:bg-primary/80"
          style={{
            shadowColor: '#FF5A3C',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.35,
            shadowRadius: 8,
            elevation: 8,
          }}
        >
          <Text className="text-white text-2xl font-bold">+</Text>
        </Pressable>
      )}
    </SafeAreaView>
  );
}
