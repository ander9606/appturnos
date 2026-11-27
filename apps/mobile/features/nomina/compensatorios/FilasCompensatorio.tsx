/**
 * Filas de un descanso compensatorio para jefe_nomina / admin_empresa: pendiente (elige fecha dentro del rango
 * de 28 días que calcula el backend, RangoFechasCompensatorio) y asignado (reasignable). Las usa la pantalla
 * completa `gestor-compensatorios.tsx`, una tarjeta plegable por empleado.
 */

import { Text } from '@/components/ui/Text';
import { COLORS } from '@/lib/designTokens';
import React, { useState } from 'react';
import { View, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { DescansoCompensatorio } from '@api-client';
import { fmtFechaCorta } from '../trabajador/nominaTrabajadorUtils';
import { useAsignarCompensatorio, useReasignarCompensatorio } from './useCompensatorios';
import { diasParaVencer, textoVencimiento, colorVencimiento } from './disponibles';
import { bogotaToday } from '@/lib/formatters';
import { RangoFechasCompensatorio } from './RangoFechasCompensatorio';
import { confirm } from '@/lib/confirmDialog';

/** Art. 180/181 CST — ocasional: sin recargo, solo compensatorio; habitual: recargo + compensatorio. */
export function ClasificacionBadge({ clasificacion }: { clasificacion: DescansoCompensatorio['clasificacion'] }) {
  const esHabitual = clasificacion === 'habitual';
  return (
    <View className={`px-2 py-0.5 rounded-full ${esHabitual ? 'bg-muted' : 'bg-info-light'}`}>
      <Text className="text-[11px] font-semibold" style={{ color: esHabitual ? COLORS.slate700 : COLORS.infoText }}>
        {esHabitual ? 'Habitual · recargo' : 'Ocasional'}
      </Text>
    </View>
  );
}

// ── Fila ya asignada/tomada — reasignable a otra fecha dentro del plazo ──────
// Exportada porque gestor-compensatorios.tsx (pantalla completa) la reusa.

/** `sinNombre`: la fila va dentro de la tarjeta de un empleado, que ya muestra su nombre. */
export function AsignadoRow({ compensatorio: c, sinNombre = false }: { compensatorio: DescansoCompensatorio; sinNombre?: boolean }) {
  const [editando, setEditando] = useState(false);
  const [fecha, setFecha]       = useState<string | null>(null);
  const { mutate, isPending }   = useReasignarCompensatorio();

  async function confirmar() {
    if (!fecha) return;
    const ok = await confirm({
      title: 'Cambiar fecha del descanso',
      message: `¿Mover el descanso de ${c.trabajador_nombre} ${c.trabajador_apellido} del ${fmtFechaCorta(c.fecha_asignada!)} al ${fmtFechaCorta(fecha)}?`,
    });
    if (ok) mutate({ id: c.id, fecha }, { onSuccess: () => setEditando(false) });
  }

  if (!editando) {
    return (
      <View className="px-4 py-3 flex-row items-center justify-between">
        <View className="flex-1">
          {sinNombre ? (
            <Text className="text-sm font-semibold text-foreground">Trabajó el {fmtFechaCorta(c.origen_fecha)}</Text>
          ) : (
            <>
              <Text className="text-sm font-semibold text-foreground">
                {c.trabajador_nombre} {c.trabajador_apellido}
              </Text>
              <Text className="text-xs text-muted-foreground mt-0.5">
                Por trabajo el {fmtFechaCorta(c.origen_fecha)}
              </Text>
            </>
          )}
        </View>
        <View className="items-end gap-1">
          <ClasificacionBadge clasificacion={c.clasificacion} />
          <TouchableOpacity
            onPress={() => setEditando(true)}
            className="items-end gap-1"
            accessibilityRole="button"
            accessibilityLabel="Cambiar fecha del descanso"
          >
            <View className="bg-success-light px-2 py-0.5 rounded-full">
              <Text className="text-[11px] font-semibold" style={{ color: COLORS.successText }}>Asignado</Text>
            </View>
            <Text className="text-xs text-primary underline">
              {fmtFechaCorta(c.fecha_asignada!)}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View className="px-4 py-3 gap-2">
      <View className="flex-row items-start justify-between">
        <View className="flex-1">
          {!sinNombre && (
            <Text className="text-sm font-semibold text-foreground">
              {c.trabajador_nombre} {c.trabajador_apellido}
            </Text>
          )}
          <Text className={sinNombre ? 'text-sm font-semibold text-foreground' : 'text-xs text-muted-foreground mt-0.5'}>
            Actualmente el {fmtFechaCorta(c.fecha_asignada!)} · por trabajo el {fmtFechaCorta(c.origen_fecha)}
          </Text>
        </View>
      </View>

      <RangoFechasCompensatorio compensatorioId={c.id} seleccionada={fecha ?? ''} onSeleccionar={setFecha} />

      <View className="flex-row gap-2 items-center">
        <TouchableOpacity
          onPress={() => { setEditando(false); setFecha(null); }}
          className="px-3 py-2 rounded-xl bg-muted"
        >
          <Text className="text-sm font-semibold text-muted-foreground">Cancelar</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={confirmar}
          disabled={isPending || !fecha}
          className={`flex-1 items-center px-4 py-2 rounded-xl ${isPending || !fecha ? 'bg-muted' : 'bg-primary'}`}
        >
          <Text className={`text-sm font-semibold ${isPending || !fecha ? 'text-muted-foreground' : 'text-white'}`}>
            {isPending ? 'Guardando…' : fecha ? `Mover a ${fmtFechaCorta(fecha)}` : 'Elige una fecha'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Fila pendiente — elige fecha con el rango de colores ────────────────────

/** `sinNombre`: la fila va dentro de la tarjeta de un empleado, que ya muestra su nombre. */
export function CompensatorioRow({ compensatorio: c, sinNombre = false }: { compensatorio: DescansoCompensatorio; sinNombre?: boolean }) {
  const [showPicker, setShowPicker] = useState(false);
  const [fecha, setFecha]           = useState<string | null>(null);
  const { mutate, isPending }       = useAsignarCompensatorio();
  const dias = diasParaVencer(c.origen_fecha, bogotaToday());

  async function confirmar() {
    if (!fecha) return;
    const ok = await confirm({
      title: 'Confirmar descanso',
      message: `¿Asignar el ${fmtFechaCorta(fecha)} como descanso para ${c.trabajador_nombre} ${c.trabajador_apellido}?`,
    });
    if (ok) mutate({ id: c.id, fecha }, { onSuccess: () => setShowPicker(false) });
  }

  return (
    <View className="px-4 py-3 gap-3">
      <View className="flex-row items-start justify-between gap-2">
        <View className="flex-1 gap-0.5">
          {!sinNombre && (
            <Text className="text-sm font-semibold text-foreground">{c.trabajador_nombre} {c.trabajador_apellido}</Text>
          )}
          <Text className={sinNombre ? 'text-sm font-semibold text-foreground' : 'text-xs text-muted-foreground'}>
            Trabajó el {fmtFechaCorta(c.origen_fecha)}
          </Text>
          <View className="flex-row items-center gap-1">
            <Ionicons name="time-outline" size={12} color={colorVencimiento(dias)} />
            <Text className="text-xs font-medium" style={{ color: colorVencimiento(dias) }}>{textoVencimiento(dias)}</Text>
          </View>
        </View>
        <ClasificacionBadge clasificacion={c.clasificacion} />
      </View>

      {!showPicker ? (
        <TouchableOpacity
          onPress={() => setShowPicker(true)}
          accessibilityRole="button"
          className="self-start bg-muted rounded-xl px-3 py-2 flex-row items-center gap-2"
        >
          <Ionicons name="calendar-outline" size={14} color={COLORS.mutedForeground} />
          <Text className="text-sm text-foreground">Elegir fecha</Text>
        </TouchableOpacity>
      ) : (
        <View className="gap-2">
          <RangoFechasCompensatorio compensatorioId={c.id} seleccionada={fecha ?? ''} onSeleccionar={setFecha} />

          <View className="flex-row gap-2 items-center">
            <TouchableOpacity
              onPress={() => { setShowPicker(false); setFecha(null); }}
              className="px-3 py-2 rounded-xl bg-muted"
            >
              <Text className="text-sm font-semibold text-muted-foreground">Cancelar</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={confirmar}
              disabled={isPending || !fecha}
              className={`flex-1 items-center px-4 py-2 rounded-xl ${isPending || !fecha ? 'bg-muted' : 'bg-primary'}`}
            >
              <Text className={`text-sm font-semibold ${isPending || !fecha ? 'text-muted-foreground' : 'text-white'}`}>
                {isPending ? 'Guardando…' : fecha ? `Asignar ${fmtFechaCorta(fecha)}` : 'Elige una fecha'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}
