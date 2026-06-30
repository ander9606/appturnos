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
  ScrollView,
  TextInput,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { Ionicons } from '@expo/vector-icons';

import { useAuthStore } from '@/features/auth/useAuthStore';
import { useTrabajadores, useMe } from '@/features/equipo/useEquipo';
import { useMisEmpresas, useSolicitudes } from '@/features/empresas/useTrabajadorEmpresa';
import { useAusenciasPendientesCount } from '@/features/ausencias/useAusencias';
import { useMisTurnos } from '@/features/turnos/useTurnos';
import { useNominaPerfil } from '@/features/nomina/useNomina';
import { COLORS } from '@/lib/designTokens';
import { useTheme } from '@/lib/theme';
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

// ── Worker view — Mi perfil laboral ──────────────────────────────────────

function WorkerView() {
  const router  = useRouter();
  const usuario = useAuthStore((s) => s.usuario);
  const theme   = useTheme();

  const { data: perfil, isLoading, refetch, isRefetching } = useMe();
  const { data: turnos = [] } = useMisTurnos();

  const completados = turnos.filter((t) => t.estado === 'completado').length;
  const cargos      = perfil?.cargos      ?? [];
  const experiencias = perfil?.experiencias ?? [];
  const diplomas    = perfil?.diplomas     ?? [];

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center" edges={['top']}>
        <ActivityIndicator color={theme.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={theme.primary} colors={[theme.primary]} />
        }
      >
        {/* ── Hero ─────────────────────────────────────────────────── */}
        <View className="pt-6 pb-8 px-6 rounded-b-[32px] items-center gap-3" style={{ backgroundColor: theme.primary }}>
          <View className="w-20 h-20 rounded-full bg-white/20 items-center justify-center">
            <Text className="text-3xl font-bold text-white">
              {(usuario?.nombre?.[0] ?? '?').toUpperCase()}
            </Text>
          </View>
          <View className="items-center gap-0.5">
            <Text className="text-xl font-bold text-white">{usuario?.nombre} {perfil?.apellido ?? ''}</Text>
            <Text className="text-sm text-white/70">{perfil?.cargo ?? 'Trabajador de turnos'}</Text>
          </View>
          {/* Ranking */}
          {perfil?.ranking != null && (
            <View className="flex-row items-center gap-1 bg-white/15 px-3 py-1.5 rounded-full">
              <Ionicons name="star" size={14} color="#FCD34D" />
              <Text className="text-sm font-bold text-white">{perfil.ranking.toFixed(1)}</Text>
              <Text className="text-xs text-white/70">· {perfil.total_calificaciones} calif.</Text>
            </View>
          )}
        </View>

        <View className="px-5 pt-5 gap-4">

          {/* ── Stats ─────────────────────────────────────────────── */}
          <View className="flex-row gap-3">
            <View className="flex-1 bg-card rounded-2xl border border-border p-4 items-center gap-0.5">
              <Text className="text-2xl font-bold text-success">{completados}</Text>
              <Text className="text-xs text-muted-foreground">Completados</Text>
            </View>
            <View className="flex-1 bg-card rounded-2xl border border-border p-4 items-center gap-0.5">
              <Text className="text-2xl font-bold text-info">{cargos.length}</Text>
              <Text className="text-xs text-muted-foreground">Cargos</Text>
            </View>
            <View className="flex-1 bg-card rounded-2xl border border-border p-4 items-center gap-0.5">
              <Text className="text-2xl font-bold text-foreground">{experiencias.length}</Text>
              <Text className="text-xs text-muted-foreground">Experiencias</Text>
            </View>
          </View>

          {/* ── Cargos ───────────────────────────────────────────── */}
          {cargos.length > 0 && (
            <View className="bg-card rounded-2xl border border-border overflow-hidden">
              <View className="px-5 py-3 border-b border-border">
                <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Cargos que desempeña</Text>
              </View>
              {cargos.map((c, i) => (
                <View key={c.id} className={`px-5 py-3 flex-row items-center gap-3 ${i > 0 ? 'border-t border-border' : ''}`}>
                  <Ionicons name="checkmark-circle-outline" size={16} color="#22C55E" />
                  <View className="flex-1">
                    <Text className="text-sm font-medium text-foreground">{c.nombre}</Text>
                    {c.codigo && <Text className="text-xs text-muted-foreground">{c.codigo}</Text>}
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* ── Experiencia ──────────────────────────────────────── */}
          {experiencias.length > 0 && (
            <View className="bg-card rounded-2xl border border-border overflow-hidden">
              <View className="px-5 py-3 border-b border-border">
                <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Experiencia laboral</Text>
              </View>
              {experiencias.map((e, i) => (
                <View key={e.id} className={`px-5 py-3 gap-0.5 ${i > 0 ? 'border-t border-border' : ''}`}>
                  <Text className="text-sm font-semibold text-foreground">{e.cargo}</Text>
                  <Text className="text-xs text-muted-foreground">{e.empresa_nombre}</Text>
                  <Text className="text-xs text-muted-foreground">
                    {e.fecha_inicio?.slice(0, 7)} – {e.fecha_fin?.slice(0, 7) ?? 'presente'}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* ── Diplomas ─────────────────────────────────────────── */}
          {diplomas.length > 0 && (
            <View className="bg-card rounded-2xl border border-border overflow-hidden">
              <View className="px-5 py-3 border-b border-border">
                <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Formación y diplomas</Text>
              </View>
              {diplomas.map((d, i) => (
                <View key={d.id} className={`px-5 py-3 gap-0.5 ${i > 0 ? 'border-t border-border' : ''}`}>
                  <Text className="text-sm font-semibold text-foreground">{d.titulo}</Text>
                  <Text className="text-xs text-muted-foreground">{d.institucion}{d.anio ? ` · ${d.anio}` : ''}</Text>
                </View>
              ))}
            </View>
          )}

          {/* ── Datos de contacto / pago ─────────────────────────── */}
          <View className="bg-card rounded-2xl border border-border overflow-hidden">
            <View className="px-5 py-3 border-b border-border">
              <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Mis datos</Text>
            </View>
            {[
              { label: 'Teléfono',   value: perfil?.telefono,       icon: 'call-outline' as const },
              { label: 'EPS',        value: perfil?.eps,            icon: 'medkit-outline' as const },
              { label: 'AFP',        value: perfil?.afp,            icon: 'shield-outline' as const },
              { label: 'Banco',      value: perfil?.banco,          icon: 'card-outline' as const },
            ].filter((r) => r.value).map((row, i) => (
              <View key={row.label} className={`px-5 py-3 flex-row items-center gap-3 ${i > 0 ? 'border-t border-border' : ''}`}>
                <Ionicons name={row.icon} size={16} color="#94A3B8" />
                <Text className="text-xs text-muted-foreground w-20">{row.label}</Text>
                <Text className="text-sm text-foreground flex-1">{row.value}</Text>
              </View>
            ))}
          </View>

          {/* ── Empresas ─────────────────────────────────────────── */}
          <Pressable
            onPress={() => router.push('/mis-empresas')}
            className="bg-card rounded-2xl border border-border px-5 py-4 flex-row items-center justify-between active:opacity-70"
          >
            <View className="flex-row items-center gap-3">
              <View className="w-10 h-10 rounded-xl items-center justify-center" style={{ backgroundColor: theme.primary + '18' }}>
                <Ionicons name="business-outline" size={20} color={theme.primary} />
              </View>
              <View>
                <Text className="text-sm font-semibold text-foreground">Mis empresas</Text>
                <Text className="text-xs text-muted-foreground mt-0.5">Vínculos, solicitudes e invitaciones</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
          </Pressable>

        </View>
      </ScrollView>
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

  const { data: solicitudesData = [] } = useSolicitudes();
  const pendientesCount = solicitudesData.length;
  const { data: ausenciasPendientes } = useAusenciasPendientesCount();
  const ausenciasCount = ausenciasPendientes?.total ?? 0;

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
          {/* Ausencias pendientes badge — todos los gestores */}
          {canManage && ausenciasCount > 0 && (
            <Pressable
              onPress={() => router.push('/ausencias')}
              className="flex-row items-center gap-1.5 bg-warning/10 border border-warning/30 rounded-full px-3 py-1.5"
            >
              <Ionicons name="calendar-clear-outline" size={13} color="#D97706" />
              <Text className="text-xs font-semibold text-warning">
                {ausenciasCount} ausencia{ausenciasCount > 1 ? 's' : ''} pendiente{ausenciasCount > 1 ? 's' : ''}
              </Text>
            </Pressable>
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
