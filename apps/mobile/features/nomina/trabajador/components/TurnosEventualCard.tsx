/**
 * TurnosEventualCard — acumulado de turnos extra (trimestral) del trabajador_nomina.
 * Mismo lenguaje visual que el banner equivalente en app/(tabs)/turnos.tsx.
 * null si no activó acepta_extras o todavía no hay período (autocreado on-demand
 * por el backend en cuanto el trabajador consulta, así que solo falta mientras carga).
 */
import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { formatCOP } from '@/lib/formatters';
import type { PeriodoTurnoEventual, LineaLiquidacionEventual } from '@api-client';

interface Props {
  aceptaExtras: boolean;
  periodo: PeriodoTurnoEventual | undefined;
  linea: LineaLiquidacionEventual | undefined;
}

export function TurnosEventualCard({ aceptaExtras, periodo, linea }: Props) {
  const router = useRouter();
  if (!aceptaExtras || !periodo) return null;

  const liquidado = periodo.estado === 'liquidado';

  return (
    <TouchableOpacity
      onPress={() => router.push('/liquidacion-eventual')}
      activeOpacity={0.8}
      className="bg-violet-50 border border-violet-200 rounded-2xl px-4 py-3 flex-row items-center gap-3"
    >
      <Ionicons name="briefcase-outline" size={20} color="#7C3AED" />
      <View className="flex-1">
        <Text className="text-sm font-semibold text-violet-700">Turnos eventuales · Pago trimestral</Text>
        {linea ? (
          <Text className="text-xs text-violet-500 mt-0.5">
            {linea.turnos} turno{linea.turnos !== 1 ? 's' : ''} · {formatCOP(linea.total)}
            {liquidado ? ' · Liquidado' : ''}
          </Text>
        ) : (
          <Text className="text-xs text-violet-500 mt-0.5">
            {liquidado ? 'Período liquidado' : `Período abierto hasta ${periodo.fecha_fin}`}
          </Text>
        )}
      </View>
      <Ionicons name="chevron-forward-outline" size={16} color="#7C3AED" />
    </TouchableOpacity>
  );
}
