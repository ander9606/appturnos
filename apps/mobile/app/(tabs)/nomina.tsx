/**
 * Nómina — Tab "Nómina"
 *
 * Enruta a la vista correcta según el rol del usuario.
 * Cada vista vive en su propio módulo de features:
 *
 *   trabajador_nomina → features/nomina/trabajador/NominaTrabajadorView
 *   trabajador_turnos → features/nomina/NominaTurnosView
 *   jefe_turnos       → features/nomina/NominaGestorTurnosView
 *   gestores          → NominaGestorView (liquidación completa, inline aquí)
 */

import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Alert, Modal,
  TextInput, KeyboardAvoidingView, Platform, Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { useAuthStore }           from '@/features/auth/useAuthStore';
import { NominaTrabajadorView }   from '@/features/nomina/trabajador';
import { NominaTurnosView }       from '@/features/nomina/NominaTurnosView';
import { NominaGestorTurnosView } from '@/features/nomina/NominaGestorTurnosView';
import { PeriodoBadge }           from '@/features/nomina/PeriodoBadge';
import { LiquidacionRow }         from '@/features/nomina/LiquidacionRow';
import { fmtPeriodo }             from '@/features/nomina/trabajador/nominaTrabajadorUtils';
import {
  usePeriodos, useLiquidacion,
  useCerrarPeriodo, useLiquidarPeriodo, useCrearPeriodo,
} from '@/features/nomina/useNomina';
import { ApiError } from '@api-client';
import type { TipoPeriodo } from '@api-client';
import { useTheme } from '@/lib/theme';
import { useRouter } from 'expo-router';

// ── Router de roles ───────────────────────────────────────────────────────

const GESTORES = ['admin_empresa', 'jefe_nomina', 'nomina'] as const;
type RolGestor = typeof GESTORES[number];

export default function NominaScreen() {
  const rol = useAuthStore((s) => s.usuario?.rol) ?? 'trabajador_nomina';

  if (GESTORES.includes(rol as RolGestor)) return <NominaGestorView />;
  if (rol === 'trabajador_turnos')         return <NominaTurnosView />;
  if (rol === 'jefe_turnos')               return <NominaGestorTurnosView />;
  return <NominaTrabajadorView />;
}

// ══════════════════════════════════════════════════════════════════════════
// Vista del GESTOR — liquidación completa del período
// ══════════════════════════════════════════════════════════════════════════

// ── Tipos día para el tipo de período ─────────────────────────────────────
const TIPOS_PERIODO: { v: TipoPeriodo; label: string }[] = [
  { v: 'quincenal', label: 'Quincenal' },
  { v: 'mensual',   label: 'Mensual'   },
  { v: 'semanal',   label: 'Semanal'   },
];

// ── Formulario de nuevo período ────────────────────────────────────────────

function NuevoPeriodoModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const theme = useTheme();
  const crearMutation = useCrearPeriodo();
  const [inicio, setInicio]   = useState('');
  const [fin, setFin]         = useState('');
  const [tipo, setTipo]       = useState<TipoPeriodo>('quincenal');
  const [error, setError]     = useState<string | null>(null);

  const RE_FECHA = /^\d{4}-\d{2}-\d{2}$/;

  const handleGuardar = async () => {
    setError(null);
    if (!RE_FECHA.test(inicio)) { setError('Ingresa la fecha de inicio en formato AAAA-MM-DD'); return; }
    if (!RE_FECHA.test(fin))    { setError('Ingresa la fecha de fin en formato AAAA-MM-DD'); return; }
    if (fin < inicio)           { setError('La fecha de fin no puede ser anterior a la de inicio'); return; }
    try {
      await crearMutation.mutateAsync({ fecha_inicio: inicio, fecha_fin: fin, tipo });
      setInicio(''); setFin(''); setError(null);
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error al crear el período');
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1 justify-end bg-black/40"
      >
        <View className="bg-background rounded-t-3xl px-6 pt-5 pb-10 gap-5">
          <View className="flex-row items-center justify-between">
            <Text className="text-lg font-bold text-foreground">Nuevo período</Text>
            <Pressable onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={22} color="#64748B" />
            </Pressable>
          </View>

          {error && (
            <View className="bg-danger/10 border border-danger/30 rounded-xl px-4 py-3">
              <Text className="text-sm text-danger">{error}</Text>
            </View>
          )}

          {/* Tipo */}
          <View className="gap-2">
            <Text className="text-sm font-semibold text-foreground">Tipo de período</Text>
            <View className="flex-row gap-2">
              {TIPOS_PERIODO.map(({ v, label }) => (
                <Pressable
                  key={v}
                  onPress={() => setTipo(v)}
                  className={`px-4 py-2 rounded-xl border ${tipo === v ? 'bg-foreground border-foreground' : 'bg-card border-border'}`}
                >
                  <Text className={`text-sm font-semibold ${tipo === v ? 'text-white' : 'text-muted-foreground'}`}>
                    {label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Fechas */}
          <View className="flex-row gap-3">
            <View className="flex-1 gap-1.5">
              <Text className="text-sm font-semibold text-foreground">Inicio</Text>
              <TextInput
                value={inicio}
                onChangeText={setInicio}
                placeholder="2025-07-01"
                placeholderTextColor="#94A3B8"
                keyboardType="numeric"
                className="bg-card border border-border rounded-xl px-4 h-12 text-base text-foreground"
              />
            </View>
            <View className="flex-1 gap-1.5">
              <Text className="text-sm font-semibold text-foreground">Fin</Text>
              <TextInput
                value={fin}
                onChangeText={setFin}
                placeholder="2025-07-15"
                placeholderTextColor="#94A3B8"
                keyboardType="numeric"
                className="bg-card border border-border rounded-xl px-4 h-12 text-base text-foreground"
              />
            </View>
          </View>
          <Text className="text-xs text-muted-foreground -mt-3">Formato: AAAA-MM-DD</Text>

          {/* Botón */}
          <TouchableOpacity
            onPress={handleGuardar}
            disabled={crearMutation.isPending}
            className="h-14 rounded-2xl items-center justify-center active:opacity-80 disabled:opacity-40"
            style={{ backgroundColor: theme.primary }}
          >
            {crearMutation.isPending
              ? <ActivityIndicator color="#fff" />
              : <Text className="text-base font-semibold text-white">Crear período</Text>
            }
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ──────────────────────────────────────────────────────────────────────────

function NominaGestorView() {
  const theme = useTheme();
  const router = useRouter();

  const { data: periodosResp, isLoading: loadingPeriodos, refetch: refetchPeriodos } =
    usePeriodos();
  const periodos = periodosResp?.data ?? [];
  const [periodoId, setPeriodoId]         = useState<number | undefined>(undefined);
  const [modalNuevo, setModalNuevo]       = useState(false);

  const activePeriodoId = periodoId ?? periodos[0]?.id;
  const activePeriodo   = periodos.find((p) => p.id === activePeriodoId) ?? periodos[0];

  const {
    data: liquidacion,
    isLoading: loadingLiq,
    refetch: refetchLiq,
    isRefetching,
  } = useLiquidacion(activePeriodoId ?? null);

  const cerrarMutation   = useCerrarPeriodo();
  const liquidarMutation = useLiquidarPeriodo();

  const onRefresh = useCallback(() => {
    refetchPeriodos();
    refetchLiq();
  }, [refetchPeriodos, refetchLiq]);

  const handleCerrar = () => {
    if (!activePeriodoId) return;
    Alert.alert(
      'Cerrar período',
      '¿Confirmas que deseas cerrar este período? Ya no se podrán añadir registros.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Cerrar',
          style: 'destructive',
          onPress: async () => {
            try {
              await cerrarMutation.mutateAsync(activePeriodoId);
              Alert.alert('Período cerrado');
            } catch (err) {
              const msg = err instanceof ApiError ? err.message : 'Error al cerrar el período';
              Alert.alert('Error', msg);
            }
          },
        },
      ],
    );
  };

  const handleLiquidar = () => {
    if (!activePeriodoId) return;
    Alert.alert(
      'Liquidar período',
      '¿Confirmas la liquidación? Esta acción es irreversible.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Liquidar',
          onPress: async () => {
            try {
              await liquidarMutation.mutateAsync(activePeriodoId);
              Alert.alert('Período liquidado');
            } catch (err) {
              const msg = err instanceof ApiError ? err.message : 'Error al liquidar';
              Alert.alert('Error', msg);
            }
          },
        },
      ],
    );
  };

  if (loadingPeriodos) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center" edges={['top']}>
        <ActivityIndicator size="large" color={theme.primary} />
      </SafeAreaView>
    );
  }

  const lineas  = liquidacion?.lineas ?? [];
  const totales = liquidacion?.totales;

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <NuevoPeriodoModal visible={modalNuevo} onClose={() => setModalNuevo(false)} />
      <FlatList
        data={lineas}
        keyExtractor={(item) => String(item.trabajador_id)}
        renderItem={({ item }) => <LiquidacionRow linea={item} />}
        contentContainerClassName="gap-2 pb-10"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={onRefresh}
            tintColor={theme.primary} colors={[theme.primary]} />
        }
        ListHeaderComponent={
          <View className="gap-4 pb-2">
            <View className="bg-success pt-4 pb-6 px-6 rounded-b-[28px] gap-2">
              <View className="flex-row items-center justify-between">
                <View>
                  <Text className="text-white/80 text-xs font-medium uppercase tracking-wide">
                    Nómina
                  </Text>
                  <Text className="text-white text-xl font-bold">
                    {activePeriodo ? fmtPeriodo(activePeriodo) : '—'}
                  </Text>
                </View>
                <View className="flex-row items-center gap-2">
                  {activePeriodo && <PeriodoBadge estado={activePeriodo.estado} />}
                  <TouchableOpacity
                    onPress={() => setModalNuevo(true)}
                    className="w-8 h-8 rounded-full bg-white/20 items-center justify-center"
                  >
                    <Ionicons name="add" size={20} color="#fff" />
                  </TouchableOpacity>
                </View>
              </View>

              {totales && (
                <View className="bg-white/15 rounded-2xl px-4 py-3 mt-1">
                  <Text className="text-white/80 text-xs">Total bruto</Text>
                  <Text className="text-white text-3xl font-extrabold">
                    ${totales.total_general.toLocaleString('es-CO')}
                  </Text>
                  <Text className="text-white/70 text-xs mt-0.5">
                    {totales.trabajadores} empleados
                  </Text>
                </View>
              )}
            </View>

            <View className="px-5 gap-3">
              {periodos.length > 0 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View className="flex-row gap-2 py-1">
                    {periodos.slice(0, 8).map((p) => (
                      <TouchableOpacity
                        key={p.id}
                        onPress={() => setPeriodoId(p.id)}
                        className={[
                          'px-4 py-2 rounded-full border flex-row items-center gap-1.5',
                          p.id === activePeriodoId
                            ? 'bg-foreground border-foreground'
                            : 'bg-card border-border',
                        ].join(' ')}
                      >
                        <Text className={`text-xs font-medium ${
                          p.id === activePeriodoId ? 'text-white' : 'text-foreground'
                        }`}>
                          {fmtPeriodo(p)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              )}

              {activePeriodo && (
                <View className="gap-2">
                  {/* Context label explaining what the current state means */}
                  <View className="flex-row items-center gap-1.5 px-1">
                    <Ionicons
                      name={
                        activePeriodo.estado === 'abierto'   ? 'lock-open-outline'
                        : activePeriodo.estado === 'cerrado' ? 'lock-closed-outline'
                        : 'checkmark-circle-outline'
                      }
                      size={14}
                      color="#64748B"
                    />
                    <Text className="text-xs text-muted-foreground">
                      {activePeriodo.estado === 'abierto'
                        ? 'Los trabajadores pueden registrar horas'
                        : activePeriodo.estado === 'cerrado'
                        ? 'Horas congeladas — pendiente de pago'
                        : 'Período pagado'}
                    </Text>
                  </View>
                  <View className="flex-row gap-2">
                    {activePeriodo.estado === 'abierto' && (
                      <TouchableOpacity
                        onPress={handleCerrar}
                        disabled={cerrarMutation.isPending}
                        className="flex-1 bg-warning-light border border-amber-200 rounded-2xl py-3 items-center"
                      >
                        <Text className="text-sm font-semibold text-amber-700">
                          {cerrarMutation.isPending ? 'Cerrando…' : 'Cerrar período'}
                        </Text>
                      </TouchableOpacity>
                    )}
                    {activePeriodo.estado === 'cerrado' && (
                      <TouchableOpacity
                        onPress={handleLiquidar}
                        disabled={liquidarMutation.isPending}
                        className="flex-1 bg-success-light border border-green-200 rounded-2xl py-3 items-center"
                      >
                        <Text className="text-sm font-semibold text-success">
                          {liquidarMutation.isPending ? 'Liquidando…' : 'Liquidar período'}
                        </Text>
                      </TouchableOpacity>
                    )}
                    {activePeriodo.estado === 'liquidado' && (
                      <View className="flex-1 bg-muted rounded-2xl py-3 items-center">
                        <Text className="text-sm text-muted-foreground">Período liquidado</Text>
                      </View>
                    )}
                  </View>
                </View>
              )}

              {activePeriodo && (
                <TouchableOpacity
                  onPress={() => router.push(`/registros-periodo?periodoId=${activePeriodoId}`)}
                  className="flex-row items-center justify-between bg-card border border-border rounded-2xl px-4 py-3"
                >
                  <View className="flex-row items-center gap-2">
                    <Ionicons name="calendar-outline" size={16} color="#64748B" />
                    <Text className="text-sm font-medium text-foreground">Registros del equipo</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color="#94A3B8" />
                </TouchableOpacity>
              )}

              <TouchableOpacity
                onPress={() => router.push('/dashboard-asistencia')}
                className="flex-row items-center justify-between bg-card border border-border rounded-2xl px-4 py-3"
              >
                <View className="flex-row items-center gap-2">
                  <Ionicons name="people-outline" size={16} color="#64748B" />
                  <Text className="text-sm font-medium text-foreground">Asistencia hoy</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color="#94A3B8" />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => router.push('/gestor-compensatorios')}
                className="flex-row items-center justify-between bg-card border border-border rounded-2xl px-4 py-3"
              >
                <View className="flex-row items-center gap-2">
                  <Ionicons name="calendar-outline" size={16} color="#64748B" />
                  <Text className="text-sm font-medium text-foreground">Descansos compensatorios</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color="#94A3B8" />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => router.push('/asignaciones-lugar')}
                className="flex-row items-center justify-between bg-card border border-border rounded-2xl px-4 py-3"
              >
                <View className="flex-row items-center gap-2">
                  <Ionicons name="location-outline" size={16} color="#64748B" />
                  <Text className="text-sm font-medium text-foreground">Asignaciones de lugar</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color="#94A3B8" />
              </TouchableOpacity>

              <Text className="text-sm font-semibold text-foreground">
                Detalle por empleado
              </Text>
            </View>
          </View>
        }
        ListEmptyComponent={
          loadingLiq ? (
            <View className="py-12 items-center">
              <ActivityIndicator color={theme.primary} />
            </View>
          ) : (
            <View className="py-12 items-center gap-3 px-8">
              <Ionicons name="bar-chart-outline" size={40} color="#94A3B8" />
              <Text className="text-base font-semibold text-foreground text-center">
                Sin registros en este período
              </Text>
            </View>
          )
        }
        ItemSeparatorComponent={() => <View className="h-2" />}
        contentContainerStyle={{ paddingHorizontal: 20 }}
      />
    </SafeAreaView>
  );
}
