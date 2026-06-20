/**
 * GestorCompensatoriosPanel — para jefe_nomina / admin_empresa.
 * Lista los descansos compensatorios pendientes y permite asignar la fecha
 * con el selector de fecha nativo del sistema (Android / iOS).
 */

import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Alert, Platform } from 'react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import type { DescansoCompensatorio } from '@api-client';
import { fmtFechaCorta } from '../trabajador/nominaTrabajadorUtils';
import { useAsignarCompensatorio } from './useCompensatorios';

interface Props {
  compensatorios: DescansoCompensatorio[];
}

export function GestorCompensatoriosPanel({ compensatorios }: Props) {
  const pendientes = compensatorios.filter((c) => c.estado === 'pendiente');
  const asignados  = compensatorios.filter((c) => c.estado === 'asignado');

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

  function confirmar() {
    const iso = fecha.toISOString().slice(0, 10);
    Alert.alert(
      'Confirmar descanso',
      `¿Asignar el ${fmtFechaCorta(iso)} como descanso compensatorio para ${c.trabajador_nombre} ${c.trabajador_apellido}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Confirmar', onPress: () => mutate({ id: c.id, fecha: iso }) },
      ]
    );
  }

  const iso = fecha.toISOString().slice(0, 10);

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

// ── Fila ya asignada (solo lectura) ──────────────────────────────────────────

function AsignadoRow({ compensatorio: c }: { compensatorio: DescansoCompensatorio }) {
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
        <View className="bg-green-50 px-2 py-0.5 rounded-full">
          <Text className="text-[10px] font-semibold text-green-700">Asignado</Text>
        </View>
        <Text className="text-xs text-muted-foreground">
          {fmtFechaCorta(c.fecha_asignada!)}
        </Text>
      </View>
    </View>
  );
}
