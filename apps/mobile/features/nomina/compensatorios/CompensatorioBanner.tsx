/**
 * CompensatorioBanner — muestra al trabajador_nomina:
 *  - Banner ámbar si tiene días compensatorios PENDIENTES (aún sin fecha).
 *  - Banner verde si tiene días compensatorios ASIGNADOS próximos. Colores por tokens (DISENO §6), cama + fecha en vez de prosa.
 */

import { COLORS } from '@/lib/designTokens';
import { Text } from '@/components/ui/Text';
import React from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { DescansoCompensatorio } from '@api-client';
import { fmtFechaCorta } from '../trabajador/nominaTrabajadorUtils';
import { bogotaToday } from '@/lib/formatters';

interface Props {
  compensatorios: DescansoCompensatorio[];
}

export function CompensatorioBanner({ compensatorios }: Props) {
  const hoy = bogotaToday();
  const pendientes = compensatorios.filter((c) => c.estado === 'pendiente');
  // ponytail: el backend pasa de 'asignado' a 'tomado' en el mismo request al crear el
  // registro del día (compensatorios.service.js asignar()) — 'asignado' nunca queda
  // observable. Con fecha futura, un 'tomado' es en realidad un descanso próximo, no pasado.
  // Upgrade path: si el backend separa ambos pasos, volver a filtrar por estado==='asignado'.
  const asignados = compensatorios.filter(
    (c) => c.estado === 'tomado' && c.fecha_asignada && c.fecha_asignada >= hoy
  );

  if (pendientes.length === 0 && asignados.length === 0) return null;

  return (
    <View className="gap-2">
      {pendientes.length > 0 && (
        <View
          className="bg-warning-light border rounded-2xl px-4 py-3 flex-row items-start gap-3"
          style={{ borderColor: COLORS.warningSoft }}
        >
          <Ionicons name="bed-outline" size={20} color={COLORS.warningText} style={{ marginTop: 1 }} />
          <View className="flex-1 gap-1">
            <Text className="text-sm font-semibold" style={{ color: COLORS.warningText }}>
              {pendientes.length === 1
                ? '1 descanso compensatorio pendiente'
                : `${pendientes.length} descansos compensatorios pendientes`}
            </Text>
            <Text className="text-xs" style={{ color: COLORS.warningText }}>
              Tu empleador asignará la fecha y te avisaremos.
            </Text>
            {pendientes.map((c) => (
              <View key={c.id} className="flex-row items-center gap-1.5">
                <Ionicons name="calendar-outline" size={12} color={COLORS.warningText} />
                <Text className="text-xs" style={{ color: COLORS.warningText }}>
                  Trabajaste el {fmtFechaCorta(c.origen_fecha)}
                  {c.clasificacion === 'habitual' ? ' · con recargo' : ''}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {asignados.map((c) => (
        <View
          key={c.id}
          className="bg-success-light border rounded-2xl px-4 py-3 flex-row items-start gap-3"
          style={{ borderColor: COLORS.successText }}
        >
          <Ionicons name="bed-outline" size={20} color={COLORS.successText} style={{ marginTop: 1 }} />
          <View className="flex-1 gap-0.5">
            <Text className="text-sm font-semibold" style={{ color: COLORS.successText }}>
              Descanso el {fmtFechaCorta(c.fecha_asignada!)}: no asistes
            </Text>
            <Text className="text-xs" style={{ color: COLORS.successText }}>
              Por tu trabajo el {fmtFechaCorta(c.origen_fecha)}
              {c.clasificacion === 'habitual' ? ' · ese día también lleva recargo' : ''}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}
