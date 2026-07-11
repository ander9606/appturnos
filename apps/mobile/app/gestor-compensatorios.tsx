/**
 * GestorCompensatorios — pantalla completa de descansos compensatorios
 * para admin_empresa / jefe_nomina.
 */

import React, { useState } from 'react';
import {
  View, Text, FlatList, ActivityIndicator,
  TouchableOpacity, Alert, Platform, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '@/lib/theme';
import { toISODate } from '@/lib/formatters';
import type { DescansoCompensatorio } from '@api-client';
import { fmtFechaCorta } from '@/features/nomina/trabajador/nominaTrabajadorUtils';
import {
  useCompensatoriosTodos,
  useAsignarCompensatorio,
} from '@/features/nomina/compensatorios/useCompensatorios';
import { useRoleGuard } from '@/components/RoleGuard';

type Filtro = 'todos' | 'pendiente' | 'asignado';

const FILTROS: { v: Filtro; label: string }[] = [
  { v: 'todos',     label: 'Todos'     },
  { v: 'pendiente', label: 'Pendientes' },
  { v: 'asignado',  label: 'Asignados'  },
];

export default function GestorCompensatoriosScreen() {
  const theme = useTheme();
  const [filtro, setFiltro] = useState<Filtro>('pendiente');

  const { data: todos = [], isLoading, isRefetching, refetch } = useCompensatoriosTodos();

  const pendientes = todos.filter((c) => c.estado === 'pendiente').length;
  const lista = filtro === 'todos' ? todos : todos.filter((c) => c.estado === filtro);

  const denied = useRoleGuard(['admin_empresa', 'jefe_nomina']);
  if (denied) return denied;

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['bottom']}>
      <Stack.Screen options={{ title: 'Descansos compensatorios', headerShown: true }} />

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : (
        <FlatList
          data={lista}
          keyExtractor={(c) => String(c.id)}
          renderItem={({ item }) =>
            item.estado === 'pendiente'
              ? <CompensatorioRow compensatorio={item} />
              : <AsignadoRow compensatorio={item} />
          }
          ItemSeparatorComponent={() => <View className="h-2" />}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={theme.primary}
              colors={[theme.primary]}
            />
          }
          ListHeaderComponent={
            <View className="gap-3 pb-3">
              {/* Resumen */}
              <View className="bg-amber-500 rounded-2xl px-5 py-4 gap-1">
                <Text className="text-white/80 text-xs font-medium uppercase tracking-wide">
                  Compensatorios
                </Text>
                <View className="flex-row items-baseline gap-2">
                  <Text className="text-white text-3xl font-extrabold">{pendientes}</Text>
                  <Text className="text-white/80 text-base">pendientes · {todos.length} total</Text>
                </View>
                <Text className="text-white/60 text-[10px] mt-1">Art. 179 CST</Text>
              </View>

              {/* Filtros */}
              <View className="flex-row gap-2">
                {FILTROS.map((f) => (
                  <TouchableOpacity
                    key={f.v}
                    onPress={() => setFiltro(f.v)}
                    className={[
                      'px-4 py-2 rounded-full border',
                      filtro === f.v
                        ? 'bg-foreground border-foreground'
                        : 'bg-card border-border',
                    ].join(' ')}
                  >
                    <Text className={`text-xs font-semibold ${filtro === f.v ? 'text-white' : 'text-muted-foreground'}`}>
                      {f.label}
                      {f.v !== 'todos' && ` · ${todos.filter((c) => c.estado === f.v).length}`}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          }
          ListEmptyComponent={
            <View className="py-16 items-center gap-3 px-8">
              <Ionicons name="calendar-outline" size={40} color="#94A3B8" />
              <Text className="text-base font-semibold text-foreground text-center">
                {filtro === 'todos' ? 'Sin descansos registrados' : `Sin descansos ${filtro === 'pendiente' ? 'pendientes' : 'asignados'}`}
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

// ── Fila pendiente ────────────────────────────────────────────────────────────

function CompensatorioRow({ compensatorio: c }: { compensatorio: DescansoCompensatorio }) {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  const [fecha, setFecha]           = useState(tomorrow);
  const [showPicker, setShowPicker] = useState(false);
  const { mutate, isPending }       = useAsignarCompensatorio();

  function onDateChange(_: DateTimePickerEvent, selected?: Date) {
    if (Platform.OS === 'android') setShowPicker(false);
    if (selected) setFecha(selected);
  }

  function confirmar() {
    const iso = toISODate(fecha);
    Alert.alert(
      'Confirmar descanso',
      `¿Asignar el ${fmtFechaCorta(iso)} como descanso para ${c.trabajador_nombre} ${c.trabajador_apellido}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Confirmar', onPress: () => mutate({ id: c.id, fecha: iso }) },
      ]
    );
  }

  const iso = toISODate(fecha);

  return (
    <View
      className="bg-card rounded-2xl px-4 py-3 gap-3"
      style={{ elevation: 1, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6 }}
    >
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

// ── Fila asignada ─────────────────────────────────────────────────────────────

function AsignadoRow({ compensatorio: c }: { compensatorio: DescansoCompensatorio }) {
  return (
    <View
      className="bg-card rounded-2xl px-4 py-3 flex-row items-center justify-between"
      style={{ elevation: 1, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6 }}
    >
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
