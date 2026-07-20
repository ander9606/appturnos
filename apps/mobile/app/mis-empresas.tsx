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
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import {
  useMisEmpresas,
  useAceptar,
  useRechazarVinculo,
  useSolicitar,
} from '@/features/empresas/useTrabajadorEmpresa';
import type { Vinculo } from '@api-client';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { confirm } from '@/lib/confirmDialog';
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
        {Number(value).toFixed(1)} · {total} {total === 1 ? 'calificación' : 'calificaciones'}
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

function ArchivadaCard({
  vinculo, onReactivar, loading,
}: {
  vinculo: Vinculo;
  onReactivar: (empresaId: number) => void;
  loading: boolean;
}) {
  const rechazado = vinculo.estado === 'rechazado';
  return (
    <View className="mx-5 mb-3 bg-card rounded-2xl border border-border overflow-hidden opacity-90">
      <View className="flex-row items-center gap-3 p-4">
        <View className="w-11 h-11 rounded-xl bg-muted items-center justify-center">
          <Ionicons name="business-outline" size={20} color="#94A3B8" />
        </View>
        <View className="flex-1">
          <Text className="text-base font-semibold text-foreground">{vinculo.empresa_nombre}</Text>
          <Text className="text-xs text-muted-foreground mt-0.5">
            {rechazado ? 'Solicitud rechazada' : 'Vínculo archivado'}
            {vinculo.fecha_resuelto ? ` · ${fmtFecha(vinculo.fecha_resuelto)}` : ''}
          </Text>
          {vinculo.motivo_rechazo && (
            <Text className="text-xs text-muted-foreground mt-1 italic" numberOfLines={2}>
              "{vinculo.motivo_rechazo}"
            </Text>
          )}
        </View>
      </View>
      <TouchableOpacity
        onPress={() => onReactivar(vinculo.empresa_id)}
        disabled={loading}
        className="border-t border-border px-4 py-3 flex-row items-center justify-center gap-1.5 active:opacity-70"
      >
        {loading
          ? <ActivityIndicator size="small" color="#FF5A3C" />
          : <>
              <Ionicons name="refresh-outline" size={14} color="#FF5A3C" />
              <Text className="text-sm font-semibold text-primary-500">Volver a solicitar</Text>
            </>
        }
      </TouchableOpacity>
    </View>
  );
}

// ── Screen ─────────────────────────────────────────────────────────────────

export default function MisEmpresasScreen() {
  const router = useRouter();
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);

  const { data, isLoading, refetch } = useMisEmpresas();
  const aceptar    = useAceptar();
  const rechazar   = useRechazarVinculo();
  const solicitar  = useSolicitar();

  const activas      = data?.activas      ?? [];
  const pendientes   = data?.pendientes   ?? [];
  const archivadas   = data?.archivadas   ?? [];
  const invitaciones = data?.invitaciones ?? [];

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

  const handleRechazar = async (id: number, tipo: 'cancelar' | 'rechazar' = 'rechazar') => {
    const esCancelar = tipo === 'cancelar';
    const ok = await confirm({
      title: esCancelar ? 'Cancelar solicitud' : 'Rechazar invitación',
      message: esCancelar
        ? '¿Estás seguro de que deseas cancelar tu solicitud para unirte a esta empresa?'
        : '¿Estás seguro de que deseas rechazar esta invitación?',
      cancelLabel: 'Volver',
      confirmLabel: esCancelar ? 'Cancelar solicitud' : 'Rechazar',
      destructive: true,
    });
    if (!ok) return;
    setActionLoadingId(id);
    try {
      await rechazar.mutateAsync({ id });
    } catch {
      Alert.alert('Error', esCancelar ? 'No se pudo cancelar' : 'No se pudo rechazar');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleReactivar = (empresaId: number) => {
    solicitar.mutate(empresaId, {
      onError: () => Alert.alert('Error', 'No se pudo enviar la solicitud.'),
    });
  };
  const reactivandoEmpresaId = solicitar.isPending ? solicitar.variables : null;

  const total = activas.length + pendientes.length + invitaciones.length;

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['bottom']}>
      <Stack.Screen
        options={{
          title: 'Mis empresas',
          headerShown: true,
          headerRight: () => (
            <TouchableOpacity
              onPress={() => router.push('/directorio-empresas')}
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
              onPress={() => router.push('/directorio-empresas')}
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
                onCancelar={(id) => handleRechazar(id, 'cancelar')}
              />
            ))}
          </View>
        )}

        {/* Archivadas / rechazadas — antes se pedían y se descartaban en silencio */}
        {archivadas.length > 0 && (
          <View className="mb-2">
            <SectionHeader title="Historial" count={archivadas.length} />
            {archivadas.map((v) => (
              <ArchivadaCard
                key={v.id}
                vinculo={v}
                onReactivar={handleReactivar}
                loading={reactivandoEmpresaId === v.empresa_id}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
