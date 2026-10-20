/**
 * Estado de la cola de eventos de integración logiq360.
 * Auto-refresca cada 30 s (configurado en useEstadoIntegracion).
 */
import { SkeletonStats } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { Spinner } from '@/components/ui/Spinner';
import { COLORS, alpha } from '@/lib/designTokens';
import React from 'react';
import {
  View,
  ScrollView,
  Pressable,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { useEstadoIntegracion, useReintentarFallidos } from '@/features/integracion/useIntegracion';
import { useTheme } from '@/lib/theme';
import { useAuthStore } from '@/features/auth/useAuthStore';
import { useRoleGuard } from '@/components/RoleGuard';
import type { ConteoEstado } from '@api-client';

// ── Helpers ───────────────────────────────────────────────────────────────

function totalPor(lista: ConteoEstado[], estado: string): number {
  return lista.find((e) => e.estado === estado)?.total ?? 0;
}

// ── Sub-components ─────────────────────────────────────────────────────────

interface StatBubbleProps {
  value: number;
  label: string;
  color: string;
  bg: string;
}

function StatBubble({ value, label, color, bg }: StatBubbleProps) {
  return (
    <View className="flex-1 rounded-2xl items-center py-4 gap-1" style={{ backgroundColor: bg }}>
      <Text className="text-2xl font-bold" style={{ color }}>{value}</Text>
      <Text className="text-xs font-medium" style={{ color: alpha(color, 0.8) }}>{label}</Text>
    </View>
  );
}

function SectionHeader({ title, icon }: { title: string; icon: React.ComponentProps<typeof Ionicons>['name'] }) {
  return (
    <View className="flex-row items-center gap-2 px-4 pt-6 pb-3">
      <Ionicons name={icon} size={16} color={COLORS.placeholder} />
      <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{title}</Text>
    </View>
  );
}

// ── Screen ─────────────────────────────────────────────────────────────────

export default function EstadoIntegracionScreen() {
  const theme = useTheme();
  // Backend (VER_ESTADO) permite admin_empresa y jefe_turnos — no 'nomina', que también llega aquí desde el dashboard.
  const rol = useAuthStore((s) => s.usuario?.rol);
  const puedeVer = rol === 'admin_empresa' || rol === 'jefe_turnos';
  const { data, isLoading, isRefetching, refetch, isError } = useEstadoIntegracion(puedeVer);
  const reintentarM = useReintentarFallidos();
  const denied = useRoleGuard(['admin_empresa', 'jefe_turnos']);
  if (denied) return denied;

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <SkeletonStats style={{ paddingHorizontal: 16, paddingTop: 12 }} />
      </SafeAreaView>
    );
  }

  if (isError || !data) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center gap-3 px-8">
        <Ionicons name="cloud-offline-outline" size={48} color={COLORS.placeholder} />
        <Text className="text-muted-foreground text-center">
          No se pudo cargar el estado de la integración
        </Text>
        <Pressable
          onPress={() => refetch()}
          className="px-5 py-2.5 rounded-xl"
          style={{ backgroundColor: alpha(theme.primary, 0.1) }}
        >
          <Text className="font-semibold" style={{ color: theme.primary }}>Reintentar</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const salientes = data.eventos.salientes;
  const entrantes = data.eventos.entrantes;

  const pendientes  = totalPor(salientes, 'pendiente');
  const enviados    = totalPor(salientes, 'enviado');
  const fallidos    = totalPor(salientes, 'fallido');
  const descartados = totalPor(salientes, 'descartado');

  const recibidos  = totalPor(entrantes, 'recibido');
  const procesados = totalPor(entrantes, 'procesado');
  const errores    = totalPor(entrantes, 'error');

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['bottom']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={theme.primary} />
        }
      >
        {/* ── Header ─────────────────────────────────────────────── */}
        <View className="px-4 pt-4 pb-6 gap-2" style={{ backgroundColor: COLORS.integracion }}>
          <View className="flex-row items-center justify-between">
            <Text className="text-white text-lg font-bold">Estado de la cola</Text>
            <View
              className="flex-row items-center gap-1.5 px-3 py-1 rounded-full"
              style={{ backgroundColor: data.activo ? alpha(COLORS.success, 0.13) : alpha(COLORS.danger, 0.13) }}
            >
              <View
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: data.activo ? COLORS.success : COLORS.danger }}
              />
              <Text
                className="text-xs font-semibold"
                style={{ color: data.activo ? COLORS.success : COLORS.danger }}
              >
                {data.activo ? 'Activa' : 'Inactiva'}
              </Text>
            </View>
          </View>
          <Text className="text-white/70 text-sm">
            Se actualiza automáticamente cada 30 segundos
          </Text>
        </View>

        {/* ── Eventos salientes ──────────────────────────────────── */}
        <SectionHeader title="Eventos salientes" icon="arrow-up-circle-outline" />

        <View className="px-4 flex-row gap-3">
          <StatBubble value={pendientes}  label="Pendientes" color={COLORS.warning} bg={alpha(COLORS.warning, 0.1)} />
          <StatBubble value={enviados}    label="Enviados"   color={COLORS.success} bg={alpha(COLORS.success, 0.1)} />
          <StatBubble value={fallidos}    label="Fallidos"   color={COLORS.danger} bg={alpha(COLORS.danger, 0.1)} />
        </View>

        {descartados > 0 && (
          <View className="mx-4 mt-3 flex-row items-center gap-2 bg-card border border-border rounded-xl px-4 py-3">
            <Ionicons name="trash-outline" size={16} color={COLORS.placeholder} />
            <Text className="text-sm text-muted-foreground">
              {descartados} evento{descartados !== 1 ? 's' : ''} descartado{descartados !== 1 ? 's' : ''} (máx. reintentos alcanzado)
            </Text>
          </View>
        )}

        {fallidos > 0 && (
          <View className="mx-4 mt-3 bg-danger/10 border border-danger/30 rounded-xl px-4 py-3 gap-2">
            <View className="flex-row items-center gap-2">
              <Ionicons name="alert-circle-outline" size={16} color={COLORS.danger} />
              <Text className="text-sm text-danger flex-1">
                {fallidos} evento{fallidos !== 1 ? 's' : ''} fallido{fallidos !== 1 ? 's' : ''}. Verifica la URL del webhook.
              </Text>
            </View>
            <Pressable
              onPress={() => reintentarM.mutate()}
              disabled={reintentarM.isPending}
              className="self-start flex-row items-center gap-1.5 bg-danger/20 px-3 py-1.5 rounded-lg"
            >
              {reintentarM.isPending
                ? <Spinner size="small" color={COLORS.danger} />
                : <Ionicons name="refresh-outline" size={14} color={COLORS.danger} />
              }
              <Text className="text-xs font-semibold text-danger">
                {reintentarM.isPending ? 'Re-encolando…' : 'Reintentar ahora'}
              </Text>
            </Pressable>
          </View>
        )}

        {/* ── Eventos entrantes ──────────────────────────────────── */}
        <SectionHeader title="Eventos entrantes" icon="arrow-down-circle-outline" />

        <View className="px-4 flex-row gap-3">
          <StatBubble value={recibidos}  label="Recibidos"  color={COLORS.integracion} bg={alpha(COLORS.integracion, 0.1)} />
          <StatBubble value={procesados} label="Procesados" color={COLORS.success} bg={alpha(COLORS.success, 0.1)} />
          <StatBubble value={errores}    label="Errores"    color={COLORS.danger} bg={alpha(COLORS.danger, 0.1)} />
        </View>

        {/* ── Webhook URL status ─────────────────────────────────── */}
        <View className="mx-4 mt-6 bg-card border border-border rounded-2xl px-4 py-4 gap-2">
          <Text className="text-sm font-semibold text-foreground">Webhook saliente</Text>
          <View className="flex-row items-center gap-2">
            {data.webhook_configurado ? (
              <>
                <Ionicons name="checkmark-circle" size={16} color={COLORS.success} />
                <Text className="text-sm text-success">URL configurada</Text>
              </>
            ) : (
              <>
                <Ionicons name="warning-outline" size={16} color={COLORS.warning} />
                <Text className="text-sm text-warning">Sin URL de destino configurada</Text>
              </>
            )}
          </View>
          {!data.webhook_configurado && (
            <Text className="text-xs text-muted-foreground">
              Los eventos salientes no se enviarán hasta que configures la URL del webhook de logiq360.
            </Text>
          )}
        </View>

        {/* ── Sin actividad ──────────────────────────────────────── */}
        {enviados + pendientes + fallidos + recibidos + procesados === 0 && (
          <View className="items-center gap-3 px-8 mt-8">
            <Ionicons name="pulse-outline" size={40} color={COLORS.placeholder} />
            <Text className="text-muted-foreground text-center text-sm">
              Sin actividad registrada aún.{'\n'}Los eventos aparecerán aquí cuando logiq360 esté conectado.
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
