/**
 * GestorCompensatoriosPanel — para jefe_nomina / admin_empresa.
 * Lista los descansos compensatorios pendientes y permite asignar la fecha.
 */

import React, { useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, Alert } from 'react-native';
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
        {asignados.map((c, i) => (
          <View key={c.id} className="border-t border-border">
            <AsignadoRow compensatorio={c} />
          </View>
        ))}
      </View>
    </View>
  );
}

// ── Fila pendiente con input de fecha ────────────────────────────────────────

function CompensatorioRow({ compensatorio: c }: { compensatorio: DescansoCompensatorio }) {
  const [fecha, setFecha]     = useState('');
  const { mutate, isPending } = useAsignarCompensatorio();

  function confirmar() {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
      Alert.alert('Fecha inválida', 'Escribe la fecha en formato AAAA-MM-DD');
      return;
    }
    Alert.alert(
      'Confirmar descanso',
      `¿Asignar el ${fmtFechaCorta(fecha)} como descanso compensatorio para ${c.trabajador_nombre} ${c.trabajador_apellido}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Confirmar', onPress: () => mutate({ id: c.id, fecha }) },
      ]
    );
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
        <View className="bg-warning-light px-2 py-0.5 rounded-full">
          <Text className="text-[10px] font-semibold text-amber-700">Pendiente</Text>
        </View>
      </View>

      <View className="flex-row gap-2 items-center">
        <TextInput
          value={fecha}
          onChangeText={setFecha}
          placeholder="AAAA-MM-DD"
          placeholderTextColor="#94A3B8"
          keyboardType="numeric"
          maxLength={10}
          className="flex-1 bg-muted rounded-xl px-3 py-2 text-sm text-foreground"
        />
        <TouchableOpacity
          onPress={confirmar}
          disabled={isPending || fecha.length < 10}
          className={`px-4 py-2 rounded-xl ${isPending || fecha.length < 10 ? 'bg-muted' : 'bg-primary'}`}
        >
          <Text className={`text-sm font-semibold ${isPending || fecha.length < 10 ? 'text-muted-foreground' : 'text-white'}`}>
            {isPending ? 'Guardando…' : 'Asignar'}
          </Text>
        </TouchableOpacity>
      </View>
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
