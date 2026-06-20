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
import { useMisEmpresas, useSolicitudes } from '@/features/empresas/useTrabajadorEmpresa';
import { useNominaPerfil } from '@/features/nomina/useNomina';
import { COLORS } from '@/lib/designTokens';
import { TrabajadorCard } from '@/features/equipo/TrabajadorCard';
import type { Trabajador, TipoTrabajador } from '@api-client';

// ── Constants ─────────────────────────────────────────────────────────────

const MANAGE_ROLES = ['admin_empresa', 'jefe_turnos', 'jefe_nomina', 'nomina'];

// ── Nomina worker view — Mi empresa (singular) ───────────────────────────

function MiEmpresaNominaView() {
  const { data: perfil, isLoading } = useNominaPerfil();

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center" edges={['top']}>
        <ActivityIndicator color="#64748B" />
      </SafeAreaView>
    );
  }

  const cargos = perfil?.cargos ?? [];
  const cargoTexto = perfil?.cargo ?? null;

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <View className="px-5 pt-4 pb-3">
        <Text className="text-2xl font-bold text-foreground">Mi empresa</Text>
        <Text className="text-sm text-muted-foreground mt-0.5">
          Tu vínculo laboral actual
        </Text>
      </View>

      <View className="px-5 gap-3">
        {/* Empresa */}
        <View className="bg-card rounded-2xl border border-border px-5 py-4 flex-row items-center gap-4">
          <View className="w-12 h-12 rounded-2xl bg-primary/10 items-center justify-center">
            <Ionicons name="business-outline" size={22} color="#FF5A3C" />
          </View>
          <View className="flex-1">
            <Text className="text-base font-bold text-foreground">
              {perfil?.empresa_nombre ?? '—'}
            </Text>
            <Text className="text-xs text-muted-foreground mt-0.5">Empresa empleadora</Text>
          </View>
        </View>

        {/* Cargo de texto (campo libre del trabajador) */}
        {cargoTexto && (
          <View className="bg-card rounded-2xl border border-border px-5 py-4 flex-row items-center gap-4">
            <View className="w-12 h-12 rounded-2xl bg-blue-50 items-center justify-center">
              <Ionicons name="briefcase-outline" size={22} color="#3B82F6" />
            </View>
            <View className="flex-1">
              <Text className="text-base font-semibold text-foreground">{cargoTexto}</Text>
              <Text className="text-xs text-muted-foreground mt-0.5">Cargo</Text>
            </View>
          </View>
        )}

        {/* Cargos certificados (del catálogo de la empresa) */}
        {cargos.length > 0 && (
          <View className="bg-card rounded-2xl border border-border overflow-hidden">
            <View className="px-5 py-3 border-b border-border">
              <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Cargos que desempeña
              </Text>
            </View>
            {cargos.map((c, i) => (
              <View
                key={c.id}
                className={`px-5 py-3 flex-row items-center gap-3 ${i > 0 ? 'border-t border-border' : ''}`}
              >
                <Ionicons name="checkmark-circle-outline" size={16} color="#22C55E" />
                <View className="flex-1">
                  <Text className="text-sm font-medium text-foreground">{c.nombre}</Text>
                  {c.codigo && (
                    <Text className="text-xs text-muted-foreground">{c.codigo}</Text>
                  )}
                </View>
              </View>
            ))}
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

// ── Worker view ───────────────────────────────────────────────────────────

function WorkerView() {
  const router = useRouter();
  const rol    = useAuthStore((s) => s.usuario?.rol);
  // Only trabajador_turnos can call mis-empresas; trabajador_nomina gets a 403
  const { data, isLoading } = useMisEmpresas({ enabled: rol === 'trabajador_turnos' });
  const activas     = data?.activas     ?? [];
  const pendientes  = data?.pendientes  ?? [];
  const invitaciones = data?.invitaciones ?? [];

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <View className="px-5 pt-4 pb-3">
        <Text className="text-2xl font-bold text-foreground">Mis empresas</Text>
        <Text className="text-sm text-muted-foreground mt-0.5">
          Gestiona tus vínculos con empresas
        </Text>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#FF5A3C" />
        </View>
      ) : (
        <View className="px-5 gap-3">
          {/* Stats row */}
          <View className="flex-row gap-3">
            <View className="flex-1 bg-card rounded-2xl border border-border p-4 items-center">
              <Text className="text-2xl font-bold text-success">{activas.length}</Text>
              <Text className="text-xs text-muted-foreground mt-0.5">Activas</Text>
            </View>
            <View className="flex-1 bg-card rounded-2xl border border-border p-4 items-center">
              <Text className="text-2xl font-bold text-warning">{pendientes.length}</Text>
              <Text className="text-xs text-muted-foreground mt-0.5">Pendientes</Text>
            </View>
            {invitaciones.length > 0 && (
              <View className="flex-1 bg-primary-50 rounded-2xl border border-primary-200 p-4 items-center">
                <Text className="text-2xl font-bold text-primary-500">{invitaciones.length}</Text>
                <Text className="text-xs text-muted-foreground mt-0.5">Invitaciones</Text>
              </View>
            )}
          </View>

          {/* CTA */}
          <Pressable
            onPress={() => router.push('/mis-empresas')}
            className="bg-card rounded-2xl border border-border px-5 py-4 flex-row items-center justify-between active:opacity-70"
          >
            <View className="flex-row items-center gap-3">
              <View className="w-10 h-10 rounded-xl bg-primary-50 items-center justify-center">
                <Ionicons name="business-outline" size={20} color="#FF5A3C" />
              </View>
              <View>
                <Text className="text-sm font-semibold text-foreground">Gestionar vínculos</Text>
                <Text className="text-xs text-muted-foreground mt-0.5">
                  Solicitudes, invitaciones y empresas activas
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
          </Pressable>
        </View>
      )}
    </SafeAreaView>
  );
}

// ── Admin solicitudes badge ────────────────────────────────────────────────

function SolicitudesBadge({ count, onPress }: { count: number; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center gap-1 rounded-full px-3 py-1.5 border border-border bg-card mt-1 active:opacity-70"
    >
      <Ionicons name="people-outline" size={14} color="#64748B" />
      <Text className="text-xs font-semibold text-muted-foreground">Solicitudes</Text>
      {count > 0 && (
        <View className="bg-primary-500 rounded-full min-w-[16px] h-[16px] items-center justify-center px-0.5">
          <Text className="text-white text-xs font-bold">{count}</Text>
        </View>
      )}
    </Pressable>
  );
}

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
  const isAdmin       = usuario?.rol === 'admin_empresa';
  const isJefeTurnos  = usuario?.rol === 'jefe_turnos';
  const canInvitar    = isAdmin || isJefeTurnos;

  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [search, setSearch] = useState('');
  const [showInactive, setShowInactive] = useState(false);

  const { data: solicitudesData = [] } = useSolicitudes(); // undefined → backend default: both pending states
  const pendientesCount = solicitudesData.length;

  const { data, isLoading, isError, refetch } = useTrabajadores({
    tipo:   filtro !== 'todos' ? filtro : undefined,
    activo: showInactive ? undefined : true,
  });

  // ── Vista trabajador ──────────────────────────────────────────────────

  if (!canManage) {
    return usuario?.rol === 'trabajador_nomina' ? <MiEmpresaNominaView /> : <WorkerView />;
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
        <View className="items-end gap-1">
          {/* Toggle inactivos */}
          <Pressable
            onPress={() => setShowInactive((v) => !v)}
            className={`rounded-full px-3 py-1.5 border ${
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
          {/* Solicitudes badge — admin y jefe_turnos */}
          {canInvitar && (
            <SolicitudesBadge
              count={pendientesCount}
              onPress={() => router.push('/solicitudes')}
            />
          )}
        </View>
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

      {/* FAB — admin: crear trabajador / jefe_turnos: invitar por cédula */}
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
      {isJefeTurnos && (
        <Pressable
          onPress={() => router.push('/invitar-trabajador')}
          className="absolute bottom-6 right-6 w-14 h-14 rounded-full bg-info items-center justify-center shadow-lg active:opacity-80"
          style={{
            shadowColor: '#3B82F6',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.35,
            shadowRadius: 8,
            elevation: 8,
          }}
        >
          <Ionicons name="person-add-outline" size={22} color="#fff" />
        </Pressable>
      )}
    </SafeAreaView>
  );
}
