/**
 * Pantalla dedicada de marcaje de jornada (trabajador_nomina).
 *
 * - Contador grande del tiempo transcurrido, actualizado cada minuto.
 * - Botón único de Entrada / Salida según el estado del día.
 * - Alerta nativa de hidratación/descanso cada 4 h trabajadas.
 */

import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Alert, ActivityIndicator, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useNominaTrabajador } from '@/features/nomina/trabajador/useNominaTrabajador';
import {
  calcularElapsedLabel,
  calcularElapsedMinutes,
} from '@/features/nomina/trabajador/nominaTrabajadorUtils';
import { fmtHora } from '@/features/nomina/trabajador/nominaTrabajadorUtils';
import { useTheme } from '@/lib/theme';
import { formatCOP } from '@/lib/formatters';

// ── Constantes ───────────────────────────────────────────────────────────────

const BREAK_INTERVAL_MIN = 240; // 4 horas

export default function NominaIngresoScreen() {
  const router = useRouter();
  const theme  = useTheme();

  const {
    estadoHoy,
    registroHoy,
    periodoActivo,
    isMutating,
    handleEntrada,
    handleSalida,
    loading,
    isRefetching,
    onRefresh,
  } = useNominaTrabajador();

  // ── Contador actualizado cada minuto ─────────────────────────────────────

  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (estadoHoy !== 'en_jornada') return;
    const id = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, [estadoHoy]);

  // ── Alerta de descanso cada 4 h ──────────────────────────────────────────

  const lastBreakThreshold = useRef<number>(0);

  useEffect(() => {
    if (estadoHoy !== 'en_jornada' || !registroHoy?.hora_entrada) return;
    const totalMin = calcularElapsedMinutes(registroHoy.hora_entrada);
    const threshold = Math.floor(totalMin / BREAK_INTERVAL_MIN);
    if (threshold > 0 && threshold !== lastBreakThreshold.current) {
      lastBreakThreshold.current = threshold;
      const horas = threshold * 4;
      Alert.alert(
        `Llevas ${horas}h trabajando`,
        '¡Tómate un descanso breve y recuerda hidratarte! Tu bienestar importa.',
        [{ text: 'Gracias', style: 'default' }],
      );
    }
  }, [tick, estadoHoy, registroHoy]);

  // ── Render helpers ────────────────────────────────────────────────────────

  const elapsed = estadoHoy === 'en_jornada' && registroHoy?.hora_entrada
    ? calcularElapsedLabel(registroHoy.hora_entrada)
    : null;

  const periodoAbierto = periodoActivo?.estado === 'abierto';

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center" edges={['top']}>
        <ActivityIndicator size="large" color={theme.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      {/* ── Header ───────────────────────────────────────────── */}
      <View
        className="pt-4 pb-6 px-6 flex-row items-center gap-3"
        style={{ backgroundColor: theme.primary }}
      >
        <TouchableOpacity onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Volver">
          <Ionicons name="chevron-back" size={24} color="white" />
        </TouchableOpacity>
        <View className="flex-1">
          <Text className="text-white text-lg font-bold">Marcaje de jornada</Text>
          {periodoActivo && (
            <Text className="text-white/70 text-xs">
              Período{' '}
              {new Date(periodoActivo.fecha_inicio + 'T00:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}
              {' – '}
              {new Date(periodoActivo.fecha_fin + 'T00:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}
            </Text>
          )}
        </View>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-6 px-6 pb-10 pt-6"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Estado sin período ────────────────────────────── */}
        {estadoHoy === 'sin_periodo' && (
          <View className="bg-card border border-border rounded-2xl p-6 items-center gap-3">
            <Ionicons name="calendar-outline" size={40} color="#94A3B8" />
            <Text className="text-base font-semibold text-foreground text-center">
              Sin período activo
            </Text>
            <Text className="text-sm text-muted-foreground text-center">
              Tu responsable aún no ha abierto un período de nómina para este mes.
              Cuando lo haga, podrás marcar entrada aquí.
            </Text>
          </View>
        )}

        {/* ── Contador grande ───────────────────────────────── */}
        {estadoHoy !== 'sin_periodo' && (
          <View className="items-center gap-3">
            {estadoHoy === 'en_jornada' ? (
              <>
                <View
                  className="w-44 h-44 rounded-full items-center justify-center"
                  style={{ backgroundColor: theme.primary + '18', borderWidth: 3, borderColor: theme.primary + '44' }}
                >
                  <Text className="text-4xl font-extrabold" style={{ color: theme.primary }}>
                    {elapsed ?? '—'}
                  </Text>
                  <Text className="text-xs text-muted-foreground mt-1">transcurrido</Text>
                </View>
                <Text className="text-sm text-muted-foreground">
                  Entrada: {fmtHora(registroHoy?.hora_entrada)}
                </Text>
              </>
            ) : estadoHoy === 'jornada_completa' ? (
              <View
                className="w-44 h-44 rounded-full items-center justify-center"
                style={{ backgroundColor: '#16a34a18', borderWidth: 3, borderColor: '#16a34a44' }}
              >
                <Ionicons name="checkmark-circle" size={48} color="#16a34a" />
                <Text className="text-sm font-bold text-success mt-1">Jornada completa</Text>
              </View>
            ) : (
              <View
                className="w-44 h-44 rounded-full items-center justify-center"
                style={{ backgroundColor: theme.primary + '12', borderWidth: 3, borderColor: theme.primary + '30' }}
              >
                <Ionicons name="log-in-outline" size={48} color={theme.primary} />
                <Text className="text-sm font-semibold mt-1" style={{ color: theme.primary }}>
                  Listo para entrar
                </Text>
              </View>
            )}
          </View>
        )}

        {/* ── Detalle de tiempos ────────────────────────────── */}
        {registroHoy && (
          <View className="bg-card border border-border rounded-2xl px-5 py-4 flex-row gap-8 justify-center">
            <View className="items-center gap-1">
              <Text className="text-xl font-extrabold text-foreground">
                {fmtHora(registroHoy.hora_entrada)}
              </Text>
              <Text className="text-xs text-muted-foreground">Entrada</Text>
            </View>
            <View className="items-center justify-center">
              <Ionicons name="arrow-forward" size={18} color="#94A3B8" />
            </View>
            <View className="items-center gap-1">
              <Text className="text-xl font-extrabold text-foreground">
                {registroHoy.hora_salida ? fmtHora(registroHoy.hora_salida) : '—'}
              </Text>
              <Text className="text-xs text-muted-foreground">Salida</Text>
            </View>
          </View>
        )}

        {/* ── Botón de marcaje ──────────────────────────────── */}
        {estadoHoy === 'sin_registro' && periodoAbierto && (
          <TouchableOpacity
            onPress={handleEntrada}
            disabled={isMutating}
            className="rounded-2xl py-5 items-center"
            style={{ backgroundColor: '#16a34a', elevation: 3, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 8 }}
            accessibilityRole="button"
            accessibilityLabel="Marcar entrada"
          >
            {isMutating
              ? <ActivityIndicator color="white" />
              : <Text className="text-white text-lg font-bold">Marcar entrada</Text>}
          </TouchableOpacity>
        )}

        {estadoHoy === 'en_jornada' && periodoAbierto && (
          <TouchableOpacity
            onPress={handleSalida}
            disabled={isMutating}
            className="rounded-2xl py-5 items-center"
            style={{ backgroundColor: '#dc2626', elevation: 3, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 8 }}
            accessibilityRole="button"
            accessibilityLabel="Marcar salida"
          >
            {isMutating
              ? <ActivityIndicator color="white" />
              : <Text className="text-white text-lg font-bold">Marcar salida</Text>}
          </TouchableOpacity>
        )}

        {estadoHoy === 'jornada_completa' && (
          <View className="rounded-2xl py-4 items-center" style={{ backgroundColor: '#16a34a20' }}>
            <Text className="text-success font-semibold">
              Jornada completada{registroHoy?.hora_salida ? ` · Salida ${fmtHora(registroHoy.hora_salida)}` : ''}
            </Text>
          </View>
        )}

        {/* ── Info período ──────────────────────────────────── */}
        {periodoActivo && (
          <View className="bg-card border border-border rounded-2xl px-4 py-3 gap-1">
            <View className="flex-row items-center gap-2">
              <Ionicons name="information-circle-outline" size={15} color="#64748B" />
              <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Período {periodoActivo.estado}
              </Text>
            </View>
            <Text className="text-xs text-muted-foreground">
              {periodoActivo.estado === 'abierto'
                ? 'Puedes marcar entrada y salida mientras el período esté abierto.'
                : periodoActivo.estado === 'cerrado'
                ? 'El período fue cerrado. Las horas ya no se pueden modificar y están pendientes de pago.'
                : 'Este período ya fue liquidado (pagado).'}
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
