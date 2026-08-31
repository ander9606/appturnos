/**
 * GestorCompensatoriosPanel — para jefe_nomina / admin_empresa.
 * Lista los descansos compensatorios pendientes y permite asignar la fecha
 * con el selector de fecha nativo del sistema (Android / iOS).
 */

import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Platform } from 'react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import type { DescansoCompensatorio } from '@api-client';
import { fmtFechaCorta } from '../trabajador/nominaTrabajadorUtils';
import { useAsignarCompensatorio, useReasignarCompensatorio } from './useCompensatorios';
import { toISODate } from '@/lib/formatters';
import { confirm } from '@/lib/confirmDialog';

// Plazo legal (Art. 179 CST) para tomar el descanso — debe calzar con
// COMPENSATORIO_PLAZO_DIAS en backend/config/constants.js.
// ponytail: valor duplicado, no se espera que cambie — upgrade path: exponerlo en /api/nomina/me o config pública
const PLAZO_DIAS = 28;

function addDias(fechaISO: string, dias: number): Date {
  const d = new Date(`${fechaISO}T12:00:00`);
  d.setDate(d.getDate() + dias);
  return d;
}

interface Props {
  compensatorios: DescansoCompensatorio[];
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

// ── Fila pendiente con DateTimePicker nativo ──────────────────────────────────

function CompensatorioRow({ compensatorio: c }: { compensatorio: DescansoCompensatorio }) {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  const [fecha, setFecha]         = useState(tomorrow);
  const [showPicker, setShowPicker] = useState(false);
  const { mutate, isPending }     = useAsignarCompensatorio();

  function onDateChange(_: DateTimePickerEvent, selected?: Date) {
    // En Android el picker se cierra solo; en iOS permanece visible
    if (Platform.OS === 'android') setShowPicker(false);
    if (selected) setFecha(selected);
  }

  async function confirmar() {
    const iso = toISODate(fecha);
    const ok = await confirm({
      title: 'Confirmar descanso',
      message: `¿Asignar el ${fmtFechaCorta(iso)} como descanso compensatorio para ${c.trabajador_nombre} ${c.trabajador_apellido}?`,
    });
    if (ok) mutate({ id: c.id, fecha: iso });
  }

  const iso = toISODate(fecha);

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
        <View className="bg-warning-light px-2 py-0.5 rounded-full">
          <Text className="text-[10px] font-semibold text-amber-700">Pendiente</Text>
        </View>
      </View>

      <View className="flex-row gap-2 items-center">
        {/* Botón que abre el picker nativo */}
        <TouchableOpacity
          onPress={() => setShowPicker(true)}
          className="flex-1 bg-muted rounded-xl px-3 py-2 flex-row items-center gap-2"
        >
          <Ionicons name="calendar-outline" size={14} color="#64748B" />
          <Text className="text-sm text-foreground">{fmtFechaCorta(iso)}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={confirmar}
          disabled={isPending}
          className={`px-4 py-2 rounded-xl ${isPending ? 'bg-muted' : 'bg-primary'}`}
        >
          <Text className={`text-sm font-semibold ${isPending ? 'text-muted-foreground' : 'text-white'}`}>
            {isPending ? 'Guardando…' : 'Asignar'}
          </Text>
        </TouchableOpacity>
      </View>

      {showPicker && (
        <DateTimePicker
          value={fecha}
          mode="date"
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          minimumDate={tomorrow}
          onChange={onDateChange}
        />
      )}

      {/* En iOS el picker inline ocupa espacio; botón para confirmar selección */}
      {showPicker && Platform.OS === 'ios' && (
        <TouchableOpacity
          onPress={() => setShowPicker(false)}
          className="bg-primary/10 rounded-xl py-2 items-center"
        >
          <Text className="text-sm font-semibold text-primary">Listo</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ── Fila ya asignada/tomada — reasignable a otra fecha dentro del plazo ──────
// Exportada porque gestor-compensatorios.tsx (pantalla completa) la reusa.

export function AsignadoRow({ compensatorio: c }: { compensatorio: DescansoCompensatorio }) {
  const [editando, setEditando]     = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [fecha, setFecha]           = useState(() => new Date(`${c.fecha_asignada}T12:00:00`));
  const { mutate, isPending }       = useReasignarCompensatorio();

  const minDate = addDias(c.origen_fecha, 1);
  const maxDate = addDias(c.origen_fecha, PLAZO_DIAS);

  function onDateChange(_: DateTimePickerEvent, selected?: Date) {
    if (Platform.OS === 'android') setShowPicker(false);
    if (selected) setFecha(selected);
  }

  async function confirmar() {
    const iso = toISODate(fecha);
    const ok = await confirm({
      title: 'Cambiar fecha del descanso',
      message: `¿Mover el descanso de ${c.trabajador_nombre} ${c.trabajador_apellido} del ${fmtFechaCorta(c.fecha_asignada!)} al ${fmtFechaCorta(iso)}?`,
    });
    if (ok) mutate({ id: c.id, fecha: iso }, { onSuccess: () => setEditando(false) });
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
    );
  }

  const iso = toISODate(fecha);

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

      <View className="flex-row gap-2 items-center">
        <TouchableOpacity
          onPress={() => setShowPicker(true)}
          className="flex-1 bg-muted rounded-xl px-3 py-2 flex-row items-center gap-2"
        >
          <Ionicons name="calendar-outline" size={14} color="#64748B" />
          <Text className="text-sm text-foreground">{fmtFechaCorta(iso)}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setEditando(false)}
          className="px-3 py-2 rounded-xl bg-muted"
        >
          <Text className="text-sm font-semibold text-muted-foreground">Cancelar</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={confirmar}
          disabled={isPending}
          className={`px-4 py-2 rounded-xl ${isPending ? 'bg-muted' : 'bg-primary'}`}
        >
          <Text className={`text-sm font-semibold ${isPending ? 'text-muted-foreground' : 'text-white'}`}>
            {isPending ? 'Guardando…' : 'Mover'}
          </Text>
        </TouchableOpacity>
      </View>

      {showPicker && (
        <DateTimePicker
          value={fecha}
          mode="date"
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          minimumDate={minDate}
          maximumDate={maxDate}
          onChange={onDateChange}
        />
      )}

      {showPicker && Platform.OS === 'ios' && (
        <TouchableOpacity
          onPress={() => setShowPicker(false)}
          className="bg-primary/10 rounded-xl py-2 items-center"
        >
          <Text className="text-sm font-semibold text-primary">Listo</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
