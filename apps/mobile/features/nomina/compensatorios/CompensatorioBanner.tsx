/**
 * CompensatorioBanner — muestra al trabajador_nomina:
 *  - Banner ámbar si tiene días compensatorios PENDIENTES (aún sin fecha).
 *  - Banner verde si tiene días compensatorios ASIGNADOS próximos.
 */

import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { DescansoCompensatorio } from '@api-client';
import { fmtFechaCorta } from '../trabajador/nominaTrabajadorUtils';

interface Props {
  compensatorios: DescansoCompensatorio[];
}

export function CompensatorioBanner({ compensatorios }: Props) {
  const pendientes = compensatorios.filter((c) => c.estado === 'pendiente');
  const asignados  = compensatorios.filter((c) => c.estado === 'asignado');

  if (pendientes.length === 0 && asignados.length === 0) return null;

  return (
    <View className="gap-2">
      {pendientes.length > 0 && (
        <View className="bg-warning-light border border-amber-200 rounded-2xl px-4 py-3 flex-row items-start gap-3">
          <Ionicons name="time-outline" size={20} color="#92400E" style={{ marginTop: 1 }} />
          <View className="flex-1">
            <Text className="text-sm font-semibold text-amber-800">
              {pendientes.length === 1
                ? 'Tienes 1 descanso compensatorio pendiente'
                : `Tienes ${pendientes.length} descansos compensatorios pendientes`}
            </Text>
            <Text className="text-xs text-amber-700 mt-0.5">
              Tu empleador asignará la fecha. Te avisaremos cuando esté lista.
            </Text>
            <View className="gap-0.5 mt-1.5">
              {pendientes.map((c) => (
                <Text key={c.id} className="text-xs text-amber-600">
                  • Por trabajo el {fmtFechaCorta(c.origen_fecha)}
                </Text>
              ))}
            </View>
          </View>
        </View>
      )}

      {asignados.map((c) => (
        <View
          key={c.id}
          className="bg-green-50 border border-green-200 rounded-2xl px-4 py-3 flex-row items-start gap-3"
        >
          <Ionicons name="checkmark-circle-outline" size={20} color="#15803D" style={{ marginTop: 1 }} />
          <View className="flex-1">
            <Text className="text-sm font-semibold text-green-800">
              Descanso compensatorio asignado
            </Text>
            <Text className="text-xs text-green-700 mt-0.5">
              El {fmtFechaCorta(c.fecha_asignada!)} no tienes que asistir a laborar.
            </Text>
            <Text className="text-xs text-green-600 mt-0.5">
              Corresponde a tu trabajo el {fmtFechaCorta(c.origen_fecha)}.
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}
