/**
 * GestorCompensatoriosPanel — para jefe_nomina / admin_empresa.
 * Lista los descansos compensatorios pendientes y permite asignar la fecha
 * dentro del rango de 28 días que calcula el backend (RangoFechasCompensatorio).
 */

import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { DescansoCompensatorio } from '@api-client';
import { fmtFechaCorta } from '../trabajador/nominaTrabajadorUtils';
import { useAsignarCompensatorio, useReasignarCompensatorio } from './useCompensatorios';
import { RangoFechasCompensatorio } from './RangoFechasCompensatorio';
import { confirm } from '@/lib/confirmDialog';

interface Props {
  compensatorios: DescansoCompensatorio[];
}

/** Art. 180/181 CST — ocasional: sin recargo, solo compensatorio; habitual: recargo + compensatorio. */
export function ClasificacionBadge({ clasificacion }: { clasificacion: DescansoCompensatorio['clasificacion'] }) {
  const esHabitual = clasificacion === 'habitual';
  return (
    <View className={`px-2 py-0.5 rounded-full ${esHabitual ? 'bg-slate-100' : 'bg-blue-50'}`}>
      <Text className={`text-[10px] font-semibold ${esHabitual ? 'text-slate-700' : 'text-blue-700'}`}>
        {esHabitual ? 'Habitual · recargo' : 'Ocasional'}
      </Text>
    </View>
  );
}

export function GestorCompensatoriosPanel({ compensatorios }: Props) {
  const pendientes = compensatorios.filter((c) => c.estado === 'pendiente');
  const asignados  = compensatorios.filter((c) => c.estado === 'asignado' || c.estado === 'tomado');

  if (pendientes.length === 0 && asignados.length === 0) return null;

  return (
    <View className="bg-card border border-border rounded-2xl overflow-hidden">
      <View className="px-4 py-3 border-b border-border flex-row items-center gap-2">
        <Ionicons name="calendar-outline" size={16} color="#64748B" />
        <Text className="text-sm font-semibold text-foreground">
          Descansos compensatorios
        </Text>
        {pendientes.length > 0 && (
          <View className="ml-auto bg-warning-light px-2 py-0.5 rounded-full">
            <Text className="text-[10px] font-semibold text-amber-700">
              {pendientes.length} pendiente{pendientes.length > 1 ? 's' : ''}
            </Text>
          </View>
        )}
      </View>

      <View>
        {pendientes.map((c, i) => (
          <View key={c.id} className={i > 0 ? 'border-t border-border' : ''}>
            <CompensatorioRow compensatorio={c} />
          </View>
        ))}
        {asignados.map((c) => (
          <View key={c.id} className="border-t border-border">
            <AsignadoRow compensatorio={c} />
          </View>
        ))}
      </View>
    </View>
  );
}

// ── Fila pendiente — elige fecha con el rango de colores ────────────────────

function CompensatorioRow({ compensatorio: c }: { compensatorio: DescansoCompensatorio }) {
  const [showPicker, setShowPicker] = useState(false);
  const [fecha, setFecha]           = useState<string | null>(null);
  const { mutate, isPending }       = useAsignarCompensatorio();

  async function confirmar() {
    if (!fecha) return;
    const ok = await confirm({
      title: 'Confirmar descanso',
      message: `¿Asignar el ${fmtFechaCorta(fecha)} como descanso compensatorio para ${c.trabajador_nombre} ${c.trabajador_apellido}?`,
    });
    if (ok) mutate({ id: c.id, fecha }, { onSuccess: () => setShowPicker(false) });
  }

  return (
    <View className="px-4 py-3 gap-2">
      <View className="flex-row items-start justify-between">
        <View className="flex-1">
          <Text className="text-sm font-semibold text-foreground">
            {c.trabajador_nombre} {c.trabajador_apellido}
          </Text>
          <Text className="text-xs text-amber-700 mt-0.5">
            Trabajó el {fmtFechaCorta(c.origen_fecha)}
          </Text>
        </View>
        <View className="items-end gap-1">
          <ClasificacionBadge clasificacion={c.clasificacion} />
          <View className="bg-warning-light px-2 py-0.5 rounded-full">
            <Text className="text-[10px] font-semibold text-amber-700">Pendiente</Text>
          </View>
        </View>
      </View>

      {!showPicker ? (
        <TouchableOpacity
          onPress={() => setShowPicker(true)}
          className="self-start bg-muted rounded-xl px-3 py-2 flex-row items-center gap-2"
        >
          <Ionicons name="calendar-outline" size={14} color="#64748B" />
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

// ── Fila ya asignada/tomada — reasignable a otra fecha dentro del plazo ──────
// Exportada porque gestor-compensatorios.tsx (pantalla completa) la reusa.

export function AsignadoRow({ compensatorio: c }: { compensatorio: DescansoCompensatorio }) {
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
          <Text className="text-sm font-semibold text-foreground">
            {c.trabajador_nombre} {c.trabajador_apellido}
          </Text>
          <Text className="text-xs text-muted-foreground mt-0.5">
            Por trabajo el {fmtFechaCorta(c.origen_fecha)}
          </Text>
        </View>
        <View className="items-end gap-1">
          <ClasificacionBadge clasificacion={c.clasificacion} />
          <TouchableOpacity
            onPress={() => setEditando(true)}
            className="items-end gap-1"
            accessibilityRole="button"
            accessibilityLabel="Cambiar fecha del descanso"
          >
            <View className="bg-green-50 px-2 py-0.5 rounded-full">
              <Text className="text-[10px] font-semibold text-green-700">Asignado</Text>
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
          <Text className="text-sm font-semibold text-foreground">
            {c.trabajador_nombre} {c.trabajador_apellido}
          </Text>
          <Text className="text-xs text-muted-foreground mt-0.5">
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
