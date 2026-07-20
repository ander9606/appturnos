/**
 * Solicitudes de vinculación — pantalla del administrador
 *
 * Muestra la lista de solicitudes de vinculación pendientes:
 *  - Solicitadas por el trabajador (trabajador quiere unirse a la empresa)
 *  - Invitaciones enviadas por la empresa (pendientes de que el trabajador acepte)
 *
 * Acciones disponibles: Aprobar / Rechazar
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  TextInput,
  Pressable,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import {
  useSolicitudes,
  useAprobar,
  useRechazarVinculo,
} from '@/features/empresas/useTrabajadorEmpresa';
import { useCargos, useAsignarCargoAVinculo } from '@/features/turnos/useTurnos';
import type { SolicitudAdmin, ApiError } from '@api-client';
import { useRoleGuard } from '@/components/RoleGuard';
import { Avatar } from '@/components/ui/Avatar';
import { confirm } from '@/lib/confirmDialog';

// ── Helpers ───────────────────────────────────────────────────────────────

function fmtFecha(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });
}

function fmtFechaCorta(iso: string | null) {
  if (!iso) return 'actualidad';
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('es-CO', { month: 'short', year: 'numeric' });
}

// ── Sub-components ─────────────────────────────────────────────────────────

type TabEstado = 'pendientes' | 'aprobadas';

function TabBar({
  active,
  onChange,
  counts,
}: {
  active: TabEstado;
  onChange: (t: TabEstado) => void;
  counts: { pendientes: number; aprobadas: number };
}) {
  const tabs: { key: TabEstado; label: string }[] = [
    { key: 'pendientes', label: 'Pendientes' },
    { key: 'aprobadas',  label: 'Aprobadas' },
  ];

  return (
    <View className="flex-row gap-2 px-5 mb-4">
      {tabs.map(({ key, label }) => {
        const isActive = active === key;
        const count = counts[key];
        return (
          <Pressable
            key={key}
            onPress={() => onChange(key)}
            className={`flex-row items-center gap-1.5 rounded-full px-4 py-2 border ${
              isActive ? 'bg-primary-500 border-primary-500' : 'bg-card border-border'
            }`}
          >
            <Text className={`text-sm font-semibold ${isActive ? 'text-white' : 'text-muted-foreground'}`}>
              {label}
            </Text>
            {count > 0 && (
              <View className={`rounded-full min-w-[18px] h-[18px] items-center justify-center px-1 ${
                isActive ? 'bg-white/30' : 'bg-primary-500'
              }`}>
                <Text className={`text-xs font-bold ${isActive ? 'text-white' : 'text-white'}`}>{count}</Text>
              </View>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

function SolicitudCard({
  solicitud,
  onAprobar,
  onRechazar,
  loadingId,
}: {
  solicitud: SolicitudAdmin;
  onAprobar: (id: number) => void;
  onRechazar: (id: number) => void;
  loadingId: number | null;
}) {
  const isPending = solicitud.estado === 'solicitado_por_trabajador' || solicitud.estado === 'solicitado_por_empresa';
  const isActivo  = solicitud.estado === 'activo';
  const loading   = loadingId === solicitud.id;

  const estadoConfig: Record<string, { label: string; color: string; bg: string }> = {
    solicitado_por_trabajador: { label: 'Solicita unirse',    color: '#D97706', bg: '#FEF3C7' },
    solicitado_por_empresa:    { label: 'Invitación enviada', color: '#3B82F6', bg: '#EFF6FF' },
    activo:                    { label: 'Activo',             color: '#059669', bg: '#D1FAE5' },
    rechazado:                 { label: 'Rechazado',          color: '#EF4444', bg: '#FEE2E2' },
    archivado:                 { label: 'Archivado',          color: '#94A3B8', bg: '#F1F5F9' },
  };

  const cfg = estadoConfig[solicitud.estado] ?? estadoConfig.archivado;

  const perfil = solicitud.perfil_previo;
  const experienciasVisibles = perfil?.experiencias.slice(0, 3) ?? [];
  const experienciasRestantes = (perfil?.experiencias.length ?? 0) - experienciasVisibles.length;

  return (
    <View className="mx-5 mb-3 bg-card rounded-2xl border border-border overflow-hidden">
      <View className="flex-row items-center gap-3 px-4 pt-4 pb-3">
        <Avatar
          nombre={solicitud.usuario_nombre}
          apellido={solicitud.usuario_apellido}
          fotoB64={solicitud.usuario_foto_perfil}
          id={solicitud.usuario_id}
          size={44}
          expandable
        />

        {/* Info */}
        <View className="flex-1">
          <Text className="text-base font-semibold text-foreground">
            {solicitud.usuario_nombre} {solicitud.usuario_apellido}
          </Text>
          <Text className="text-xs text-muted-foreground mt-0.5">{solicitud.usuario_email}</Text>
          {solicitud.usuario_telefono && (
            <Text className="text-xs text-muted-foreground mt-0.5">{solicitud.usuario_telefono}</Text>
          )}
          <Text className="text-xs text-muted-foreground mt-0.5">
            {fmtFecha(solicitud.fecha_solicitud)}
          </Text>
        </View>

        {/* Estado badge */}
        <View className="rounded-full px-2.5 py-1" style={{ backgroundColor: cfg.bg }}>
          <Text className="text-xs font-semibold" style={{ color: cfg.color }}>{cfg.label}</Text>
        </View>
      </View>

      {/* Perfil previo — cédula/experiencia si ya trabaja en otra empresa del marketplace */}
      {perfil && (
        <View className="mx-4 mb-3 bg-background border border-border rounded-xl px-3 py-2.5 gap-1">
          <Text className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
            Ya tiene perfil en el marketplace
          </Text>
          {perfil.cedula && (
            <Text className="text-xs text-foreground">
              {perfil.tipo_documento ?? 'CC'} {perfil.cedula}
            </Text>
          )}
          {experienciasVisibles.map((exp) => (
            <Text key={exp.id} className="text-xs text-muted-foreground">
              {exp.cargo} · {exp.empresa_nombre} ({fmtFechaCorta(exp.fecha_inicio)} – {fmtFechaCorta(exp.fecha_fin)})
            </Text>
          ))}
          {experienciasRestantes > 0 && (
            <Text className="text-xs text-muted-foreground italic">+{experienciasRestantes} más</Text>
          )}
          {(perfil.diplomas.length > 0) && (
            <Text className="text-xs text-muted-foreground">
              {perfil.diplomas.length} diploma{perfil.diplomas.length !== 1 ? 's' : ''} registrado{perfil.diplomas.length !== 1 ? 's' : ''}
            </Text>
          )}
        </View>
      )}

      {/* Acciones — solo para pendientes */}
      {isPending && (
        <View className="flex-row gap-2 px-4 pb-4">
          <TouchableOpacity
            onPress={() => onRechazar(solicitud.id)}
            disabled={loading}
            className="flex-1 h-10 rounded-xl border border-border items-center justify-center active:opacity-70"
          >
            <Text className="text-sm font-semibold text-muted-foreground">Rechazar</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => onAprobar(solicitud.id)}
            disabled={loading}
            className="flex-1 h-10 rounded-xl bg-primary-500 items-center justify-center active:opacity-80"
          >
            {loading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text className="text-sm font-semibold text-white">Aprobar</Text>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

// ── Screen ─────────────────────────────────────────────────────────────────

export default function SolicitudesScreen() {
  const [tab, setTab] = useState<TabEstado>('pendientes');
  const [search, setSearch] = useState('');
  const [loadingId, setLoadingId] = useState<number | null>(null);

  // undefined → backend default = IN ('solicitado_por_trabajador', 'solicitado_por_empresa')
  // 'activo'  → vínculo ya aprobado
  const estadoFiltro = tab === 'aprobadas' ? 'activo' : undefined;
  const { data = [], isLoading, isRefetching, refetch } = useSolicitudes(estadoFiltro);

  const aprobar  = useAprobar();
  const rechazar = useRechazarVinculo();

  const { data: cargos = [] } = useCargos();
  const asignarCargo = useAsignarCargoAVinculo();
  const cargosActivos = cargos.filter((c) => c.activo);

  // Modal "elegir cargo" — se abre al aprobar; el vínculo solo se activa
  // una vez que se eligió y asignó un cargo.
  const [cargoModalId, setCargoModalId]           = useState<number | null>(null);
  const [vinculoAprobadoId, setVinculoAprobadoId] = useState<number | null>(null);
  const [selectedCargoId, setSelectedCargoId]     = useState<number | null>(null);
  const [cargoError, setCargoError]               = useState<string | null>(null);

  const denied = useRoleGuard(['admin_empresa', 'jefe_turnos']);
  if (denied) return denied;

  const term = search.trim().toLowerCase();
  const solicitudes = data.filter((s) => {
    if (!term) return true;
    return (
      s.usuario_nombre?.toLowerCase().includes(term) ||
      s.usuario_apellido?.toLowerCase().includes(term) ||
      s.usuario_email?.toLowerCase().includes(term)
    );
  });

  const pendientesCount = tab === 'pendientes' ? solicitudes.length : 0;
  const aprobadosCount  = tab === 'aprobadas'  ? solicitudes.length : 0;

  const handleAprobar = (id: number) => {
    setCargoModalId(id);
    setVinculoAprobadoId(null);
    setSelectedCargoId(null);
    setCargoError(null);
  };

  const handleConfirmarCargo = async () => {
    if (!cargoModalId || !selectedCargoId) return;
    setLoadingId(cargoModalId);
    setCargoError(null);
    try {
      // Si ya se aprobó en un intento anterior (falló solo la asignación),
      // no se vuelve a aprobar — el backend rechaza aprobar un vínculo ya activo.
      let vinculoId = vinculoAprobadoId;
      if (!vinculoId) {
        const vinculo = await aprobar.mutateAsync(cargoModalId);
        vinculoId = vinculo.id;
        setVinculoAprobadoId(vinculoId);
      }
      await asignarCargo.mutateAsync({ vinculoId, cargoId: selectedCargoId });
      setCargoModalId(null);
    } catch (err) {
      setCargoError((err as ApiError)?.message ?? 'No se pudo completar la acción.');
    } finally {
      setLoadingId(null);
    }
  };

  const handleRechazar = async (id: number) => {
    const ok = await confirm({
      title: 'Rechazar solicitud',
      message: '¿Estás seguro de que deseas rechazar esta solicitud?',
      confirmLabel: 'Rechazar',
      destructive: true,
    });
    if (!ok) return;
    setLoadingId(id);
    try {
      await rechazar.mutateAsync({ id });
    } catch {
      Alert.alert('Error', 'No se pudo rechazar la solicitud');
    } finally {
      setLoadingId(null);
    }
  };

  const solicitudEnModal = solicitudes.find((s) => s.id === cargoModalId) ?? null;
  const asignandoCargo = loadingId === cargoModalId;

  return (
    <>
    <SafeAreaView className="flex-1 bg-background" edges={['bottom']}>
      <Stack.Screen
        options={{
          title: 'Solicitudes de vinculación',
          headerShown: true,
        }}
      />

      <ScrollView
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingVertical: 16, paddingBottom: 40 }}
      >
        {/* Search */}
        <View className="px-5 mb-4">
          <View className="flex-row items-center bg-card border border-border rounded-xl px-3 h-10 gap-2">
            <Ionicons name="search-outline" size={16} color="#64748B" />
            <TextInput
              className="flex-1 text-sm text-foreground"
              placeholder="Buscar por nombre o email…"
              placeholderTextColor="#94A3B8"
              value={search}
              onChangeText={setSearch}
              autoCorrect={false}
            />
            {search.length > 0 && (
              <Pressable onPress={() => setSearch('')} hitSlop={8}>
                <Ionicons name="close-circle" size={16} color="#94A3B8" />
              </Pressable>
            )}
          </View>
        </View>

        {/* Tabs */}
        <TabBar
          active={tab}
          onChange={setTab}
          counts={{ pendientes: pendientesCount, aprobadas: aprobadosCount }}
        />

        {/* Empty state */}
        {!isLoading && solicitudes.length === 0 && (
          <View className="items-center justify-center px-8 py-16 gap-3">
            <View className="w-16 h-16 rounded-2xl bg-muted items-center justify-center">
              <Ionicons name="people-outline" size={32} color="#94A3B8" />
            </View>
            <Text className="text-lg font-bold text-foreground text-center">
              {tab === 'pendientes' ? 'Sin solicitudes pendientes' : 'Sin vínculos aprobados'}
            </Text>
            <Text className="text-sm text-muted-foreground text-center">
              {tab === 'pendientes'
                ? 'No hay solicitudes de vinculación que requieran tu atención.'
                : 'Ningún trabajador tiene vínculo activo con esta empresa aún.'}
            </Text>
          </View>
        )}

        {/* List */}
        {solicitudes.map((s) => (
          <SolicitudCard
            key={s.id}
            solicitud={s}
            onAprobar={handleAprobar}
            onRechazar={handleRechazar}
            loadingId={loadingId}
          />
        ))}
      </ScrollView>
    </SafeAreaView>

    {/* ── Modal: elegir cargo (obligatorio para aprobar) ────────────── */}
    <Modal
      visible={cargoModalId !== null}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setCargoModalId(null)}
    >
      <SafeAreaView className="flex-1 bg-background" edges={['top', 'bottom']}>
        <View className="flex-row items-center justify-between px-5 py-4 border-b border-border">
          <View className="flex-1">
            <Text className="text-base font-bold text-foreground">Asignar cargo</Text>
            {solicitudEnModal && (
              <Text className="text-xs text-muted-foreground mt-0.5">
                Para aprobar a {solicitudEnModal.usuario_nombre}, elegí el cargo que va a desempeñar.
              </Text>
            )}
          </View>
          <Pressable onPress={() => setCargoModalId(null)} hitSlop={8} disabled={asignandoCargo}>
            <Ionicons name="close" size={24} color="#64748B" />
          </Pressable>
        </View>

        {cargoError && (
          <View className="mx-5 mt-4 bg-danger-light border border-danger/30 rounded-xl px-4 py-3">
            <Text className="text-sm font-medium text-danger">{cargoError}</Text>
          </View>
        )}

        <FlatList
          data={cargosActivos}
          keyExtractor={(c) => String(c.id)}
          contentContainerStyle={{ padding: 20, paddingBottom: 8 }}
          ListEmptyComponent={
            <View className="items-center gap-2 py-10">
              <Ionicons name="briefcase-outline" size={32} color="#94A3B8" />
              <Text className="text-sm text-muted-foreground text-center">
                Tu empresa no tiene cargos creados todavía.{'\n'}Creá uno primero en "Gestión de cargos".
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const selected = selectedCargoId === item.id;
            return (
              <Pressable
                onPress={() => setSelectedCargoId(item.id)}
                className={`flex-row items-center gap-3 rounded-2xl border px-4 py-3 mb-2 active:opacity-70 ${
                  selected ? 'border-primary-500 bg-primary-50' : 'bg-card border-border'
                }`}
              >
                <View className="w-9 h-9 rounded-full bg-info/10 items-center justify-center">
                  <Ionicons name="briefcase-outline" size={16} color="#3B82F6" />
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-semibold text-foreground">{item.nombre}</Text>
                  {!!item.descripcion && (
                    <Text className="text-xs text-muted-foreground" numberOfLines={1}>
                      {item.descripcion}
                    </Text>
                  )}
                </View>
                {selected && <Ionicons name="checkmark-circle" size={20} color="#6366F1" />}
              </Pressable>
            );
          }}
        />

        <View className="px-5 pb-4 pt-2">
          <TouchableOpacity
            onPress={handleConfirmarCargo}
            disabled={!selectedCargoId || asignandoCargo}
            className="h-14 rounded-2xl items-center justify-center bg-primary-500 active:opacity-80 disabled:opacity-40"
          >
            {asignandoCargo ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-base font-semibold text-white">
                {vinculoAprobadoId ? 'Reintentar asignación' : 'Aprobar y asignar cargo'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
    </>
  );
}
