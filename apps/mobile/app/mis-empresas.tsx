/**
 * Mis Empresas — pantalla del trabajador_turnos
 *
 * Muestra:
 *  - Empresas activas (vínculos confirmados)
 *  - Solicitudes enviadas por el trabajador (pendientes de aprobación)
 *  - Invitaciones recibidas de empresas (pendientes de aceptación)
 *  - Buscador para solicitar nuevas empresas
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';

import {
  useMisEmpresas,
  useSolicitar,
  useAceptar,
  useRechazarVinculo,
} from '@/features/empresas/useTrabajadorEmpresa';
import { empresasApi } from '@api-client';
import type { Vinculo, EmpresaDirectorio } from '@api-client';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { nivelRanking, rankingLabel, rankingColor, rankingDescription } from '@/features/turnos/rankingUtils';

// ── Helpers ───────────────────────────────────────────────────────────────

function fmtFecha(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ── Sub-components ─────────────────────────────────────────────────────────

function StarRating({ value, total }: { value: number; total: number }) {
  const filled = Math.round(value);
  return (
    <View className="flex-row items-center gap-1 mt-1">
      {[1, 2, 3, 4, 5].map((i) => (
        <Ionicons
          key={i}
          name={i <= filled ? 'star' : 'star-outline'}
          size={12}
          color={i <= filled ? '#F59E0B' : '#CBD5E1'}
        />
      ))}
      <Text className="text-xs text-muted-foreground ml-0.5">
        {value.toFixed(1)} · {total} {total === 1 ? 'calificación' : 'calificaciones'}
      </Text>
    </View>
  );
}

function EmpresaActivaCard({ vinculo }: { vinculo: Vinculo }) {
  const tieneRanking = vinculo.ranking != null && vinculo.total_calificaciones > 0;
  const nivel = nivelRanking(vinculo.ranking, vinculo.total_calificaciones);
  const color = rankingColor(nivel);
  return (
    <View className="mx-5 mb-3 bg-card rounded-2xl border border-border overflow-hidden">
      <View className="flex-row items-center gap-3 p-4">
        <View className="w-11 h-11 rounded-xl bg-success/10 items-center justify-center">
          <Ionicons name="business" size={20} color="#059669" />
        </View>
        <View className="flex-1">
          <Text className="text-base font-bold text-foreground">{vinculo.empresa_nombre}</Text>
          {vinculo.empresa_ciudad && (
            <Text className="text-xs text-muted-foreground mt-0.5">{vinculo.empresa_ciudad}</Text>
          )}
          {tieneRanking ? (
            <>
              <StarRating value={vinculo.ranking!} total={vinculo.total_calificaciones} />
              <View className="flex-row items-center gap-1.5 mt-1">
                <View
                  className="rounded-full px-2 py-0.5"
                  style={{ backgroundColor: `${color}20` }}
                >
                  <Text className="text-xs font-semibold" style={{ color }}>
                    {rankingLabel(nivel)}
                  </Text>
                </View>
                <Text className="text-xs text-muted-foreground flex-1" numberOfLines={1}>
                  {rankingDescription(nivel)}
                </Text>
              </View>
            </>
          ) : (
            <Text className="text-xs text-muted-foreground mt-1">Sin calificaciones aún</Text>
          )}
        </View>
        <View className="bg-success/10 rounded-full px-2.5 py-1">
          <Text className="text-xs font-semibold text-success">Activo</Text>
        </View>
      </View>
    </View>
  );
}

function SolicitudCard({
  vinculo, onCancelar,
}: {
  vinculo: Vinculo;
  onCancelar: (id: number) => void;
}) {
  return (
    <View className="mx-5 mb-3 bg-card rounded-2xl border border-border overflow-hidden">
      <View className="flex-row items-center gap-3 p-4">
        <View className="w-11 h-11 rounded-xl bg-warning/10 items-center justify-center">
          <Ionicons name="time-outline" size={20} color="#D97706" />
        </View>
        <View className="flex-1">
          <Text className="text-base font-semibold text-foreground">{vinculo.empresa_nombre}</Text>
          <Text className="text-xs text-muted-foreground mt-0.5">
            Enviado {fmtFecha(vinculo.fecha_solicitud)}
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => onCancelar(vinculo.id)}
          className="px-3 py-1.5 rounded-xl border border-border"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text className="text-xs font-semibold text-muted-foreground">Cancelar</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function InvitacionCard({
  vinculo, onAceptar, onRechazar, loading,
}: {
  vinculo: Vinculo;
  onAceptar: (id: number) => void;
  onRechazar: (id: number) => void;
  loading: boolean;
}) {
  return (
    <View className="mx-5 mb-3 bg-card rounded-2xl border border-primary-200 overflow-hidden">
      <View className="flex-row items-center gap-3 px-4 pt-4 pb-3">
        <View className="w-11 h-11 rounded-xl bg-primary-50 items-center justify-center">
          <Ionicons name="mail-outline" size={20} color="#FF5A3C" />
        </View>
        <View className="flex-1">
          <Text className="text-base font-semibold text-foreground">{vinculo.empresa_nombre}</Text>
          <Text className="text-xs text-muted-foreground mt-0.5">
            Te invitó el {fmtFecha(vinculo.fecha_solicitud)}
          </Text>
        </View>
      </View>
      <View className="flex-row gap-2 px-4 pb-4">
        <TouchableOpacity
          onPress={() => onRechazar(vinculo.id)}
          disabled={loading}
          className="flex-1 h-10 rounded-xl border border-border items-center justify-center active:opacity-70"
        >
          <Text className="text-sm font-semibold text-muted-foreground">Rechazar</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => onAceptar(vinculo.id)}
          disabled={loading}
          className="flex-1 h-10 rounded-xl bg-primary-500 items-center justify-center active:opacity-80"
        >
          {loading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text className="text-sm font-semibold text-white">Aceptar</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Company directory search modal ────────────────────────────────────────

function DirectorioModal({
  visible,
  onClose,
  onSolicitar,
  solicitadasIds,
}: {
  visible: boolean;
  onClose: () => void;
  onSolicitar: (empresa: EmpresaDirectorio) => void;
  solicitadasIds: Set<number>;
}) {
  const [busqueda, setBusqueda] = useState('');
  const { data, isLoading } = useQuery({
    queryKey: ['empresas-directorio', busqueda],
    queryFn: () => empresasApi.directorio({ busqueda: busqueda || undefined, limit: 50 }),
    staleTime: 2 * 60_000,
    enabled: visible,
  });
  const empresas = data?.data ?? [];

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView className="flex-1 bg-background" edges={['top']}>
        {/* Header */}
        <View className="flex-row items-center gap-3 px-5 py-4 border-b border-border">
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close" size={24} color="#64748B" />
          </TouchableOpacity>
          <Text className="text-lg font-bold text-foreground flex-1">Buscar empresa</Text>
        </View>

        {/* Buscador */}
        <View className="px-5 py-3">
          <View className="flex-row items-center bg-muted rounded-2xl px-4 gap-2">
            <Ionicons name="search-outline" size={16} color="#64748B" />
            <TextInput
              className="flex-1 py-3 text-base text-foreground"
              placeholder="Nombre de la empresa…"
              placeholderTextColor="#94A3B8"
              value={busqueda}
              onChangeText={setBusqueda}
              autoFocus
            />
            {busqueda.length > 0 && (
              <Pressable onPress={() => setBusqueda('')} hitSlop={8}>
                <Ionicons name="close-circle" size={16} color="#94A3B8" />
              </Pressable>
            )}
          </View>
        </View>

        {/* Lista */}
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40, gap: 8 }}>
          {isLoading ? (
            <ActivityIndicator size="small" color="#FF5A3C" style={{ marginTop: 24 }} />
          ) : empresas.length === 0 ? (
            <Text className="text-sm text-muted-foreground text-center py-8">
              {busqueda ? 'Sin resultados' : 'No hay empresas disponibles'}
            </Text>
          ) : (
            empresas.map((emp) => {
              const yaSolicitada = solicitadasIds.has(emp.id);
              const cerrada = !emp.acepta_postulaciones;
              return (
                <Pressable
                  key={emp.id}
                  onPress={() => !yaSolicitada && !cerrada && onSolicitar(emp)}
                  disabled={yaSolicitada || cerrada}
                  className={`flex-row items-center gap-3 p-4 rounded-2xl border ${
                    yaSolicitada ? 'bg-success/5 border-success/30 opacity-60' :
                    cerrada      ? 'bg-muted border-border opacity-60' :
                                   'bg-card border-border active:opacity-70'
                  }`}
                >
                  <View className="w-10 h-10 rounded-xl bg-muted items-center justify-center">
                    <Ionicons name="business-outline" size={18} color="#64748B" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-sm font-semibold text-foreground">{emp.nombre}</Text>
                    {emp.ciudad && (
                      <Text className="text-xs text-muted-foreground mt-0.5">{emp.ciudad}</Text>
                    )}
                  </View>
                  {yaSolicitada ? (
                    <Ionicons name="checkmark-circle" size={20} color="#059669" />
                  ) : cerrada ? (
                    <View className="bg-muted px-2 py-0.5 rounded-lg">
                      <Text className="text-xs text-muted-foreground">Cerrada</Text>
                    </View>
                  ) : (
                    <View className="bg-primary-50 px-3 py-1.5 rounded-xl">
                      <Text className="text-xs font-semibold text-primary-500">Solicitar</Text>
                    </View>
                  )}
                </Pressable>
              );
            })
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

// ── Screen ─────────────────────────────────────────────────────────────────

export default function MisEmpresasScreen() {
  const [showDirectorio, setShowDirectorio] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);

  const { data, isLoading, refetch } = useMisEmpresas();
  const solicitar  = useSolicitar();
  const aceptar    = useAceptar();
  const rechazar   = useRechazarVinculo();

  const activas     = data?.activas     ?? [];
  const pendientes  = data?.pendientes  ?? [];
  const invitaciones = data?.invitaciones ?? [];

  const todasIds = new Set([
    ...activas.map((v) => v.empresa_id),
    ...pendientes.map((v) => v.empresa_id),
    ...invitaciones.map((v) => v.empresa_id),
  ]);

  const handleSolicitar = async (emp: EmpresaDirectorio) => {
    setShowDirectorio(false);
    try {
      await solicitar.mutateAsync(emp.id);
      Alert.alert('Solicitud enviada', `Tu solicitud a ${emp.nombre} está pendiente de aprobación.`);
    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'message' in err
        ? String((err as { message: string }).message) : 'Error al enviar la solicitud';
      Alert.alert('Error', msg);
    }
  };

  const handleAceptar = async (id: number) => {
    setActionLoadingId(id);
    try {
      await aceptar.mutateAsync(id);
    } catch {
      Alert.alert('Error', 'No se pudo aceptar la invitación');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleRechazar = (id: number) => {
    Alert.alert(
      'Rechazar solicitud',
      '¿Estás seguro de que deseas rechazar esta solicitud o invitación?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Rechazar',
          style: 'destructive',
          onPress: async () => {
            setActionLoadingId(id);
            try {
              await rechazar.mutateAsync({ id });
            } catch {
              Alert.alert('Error', 'No se pudo rechazar');
            } finally {
              setActionLoadingId(null);
            }
          },
        },
      ],
    );
  };

  const total = activas.length + pendientes.length + invitaciones.length;

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['bottom']}>
      <Stack.Screen
        options={{
          title: 'Mis empresas',
          headerShown: true,
          headerRight: () => (
            <TouchableOpacity
              onPress={() => setShowDirectorio(true)}
              className="flex-row items-center gap-1.5 mr-1"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="add-circle-outline" size={22} color="#FF5A3C" />
              <Text className="text-sm font-semibold text-primary-500">Buscar</Text>
            </TouchableOpacity>
          ),
        }}
      />

      <ScrollView
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} />}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingVertical: 16, paddingBottom: 40 }}
      >
        {/* Empty state */}
        {!isLoading && total === 0 && (
          <View className="items-center justify-center px-8 py-16 gap-4">
            <View className="w-20 h-20 rounded-2xl bg-muted items-center justify-center">
              <Ionicons name="business-outline" size={40} color="#94A3B8" />
            </View>
            <Text className="text-xl font-bold text-foreground text-center">
              Sin empresas todavía
            </Text>
            <Text className="text-sm text-muted-foreground text-center">
              Busca empresas del directorio para solicitar trabajar con ellas.
            </Text>
            <Pressable
              onPress={() => setShowDirectorio(true)}
              className="bg-primary-500 rounded-xl px-6 py-3 active:opacity-80"
            >
              <Text className="text-white font-semibold">Buscar empresas</Text>
            </Pressable>
          </View>
        )}

        {/* Invitaciones recibidas — primero (acción urgente) */}
        {invitaciones.length > 0 && (
          <View className="mb-2">
            <SectionHeader title="Invitaciones recibidas" count={invitaciones.length} />
            {invitaciones.map((v) => (
              <InvitacionCard
                key={v.id}
                vinculo={v}
                onAceptar={handleAceptar}
                onRechazar={handleRechazar}
                loading={actionLoadingId === v.id}
              />
            ))}
          </View>
        )}

        {/* Activas */}
        {activas.length > 0 && (
          <View className="mb-2">
            <SectionHeader title="Empresas activas" count={activas.length} />
            {activas.map((v) => (
              <EmpresaActivaCard key={v.id} vinculo={v} />
            ))}
          </View>
        )}

        {/* Solicitudes pendientes */}
        {pendientes.length > 0 && (
          <View className="mb-2">
            <SectionHeader title="Solicitudes enviadas" count={pendientes.length} />
            {pendientes.map((v) => (
              <SolicitudCard
                key={v.id}
                vinculo={v}
                onCancelar={handleRechazar}
              />
            ))}
          </View>
        )}
      </ScrollView>

      {/* Directory modal */}
      <DirectorioModal
        visible={showDirectorio}
        onClose={() => setShowDirectorio(false)}
        onSolicitar={handleSolicitar}
        solicitadasIds={todasIds}
      />
    </SafeAreaView>
  );
}
