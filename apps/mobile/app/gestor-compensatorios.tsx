/**
 * GestorCompensatorios — pantalla completa de descansos compensatorios
 * para admin_empresa / jefe_nomina.
 */

import { SkeletonList } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { Text } from '@/components/ui/Text';
import { COLORS } from '@/lib/designTokens';
import React, { useMemo, useState } from 'react';
import {
  View, FlatList, TouchableOpacity, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '@/lib/theme';
import type { DescansoCompensatorio } from '@api-client';
import {
  useCompensatoriosTodos,
} from '@/features/nomina/compensatorios/useCompensatorios';
import { AsignadoRow, CompensatorioRow } from '@/features/nomina/compensatorios/FilasCompensatorio';
import { diasParaVencer, textoVencimiento, colorVencimiento } from '@/features/nomina/compensatorios/disponibles';
import { Plegable } from '@/components/ui/Plegable';
import { bogotaToday } from '@/lib/formatters';
import { agruparPorEmpleado, type GrupoEmpleado } from '@/features/nomina/compensatorios/agruparPorEmpleado';
import { useRoleGuard } from '@/components/RoleGuard';

type Filtro = 'todos' | 'pendiente' | 'asignado';

/** 'asignado' agrupa también 'tomado' — es el estado normal tras la asignación
 * manual del jefe/admin (ver compensatorios.service.js _ejecutarAsignacion). */
function enBucket(estado: DescansoCompensatorio['estado'], filtro: Filtro): boolean {
  if (filtro === 'todos') return true;
  if (filtro === 'asignado') return estado !== 'pendiente';
  return estado === filtro;
}

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
  // Una tarjeta (tabla) por empleado, no una tarjeta por compensatorio con el nombre repetido.
  const grupos = useMemo(() => agruparPorEmpleado(todos.filter((c) => enBucket(c.estado, filtro))), [todos, filtro]);

  // Quién está desplegado: por defecto, los empleados con pendientes (hasta 3: con más, la pantalla sería otra pared de filas).
  // null = «el valor por defecto»; en cuanto el gestor toca algo se vuelve explícito y se reinicia al cambiar de filtro.
  const [abiertosUsuario, setAbiertosUsuario] = useState<Set<number> | null>(null);
  const abiertos = useMemo(
    () => abiertosUsuario ?? new Set(grupos.filter((g) => g.pendientes > 0).slice(0, 3).map((g) => g.trabajadorId)),
    [abiertosUsuario, grupos],
  );
  const alternar = (id: number) => {
    const nuevo = new Set(abiertos);
    if (!nuevo.delete(id)) nuevo.add(id);
    setAbiertosUsuario(nuevo);
  };
  const todosAbiertos = grupos.length > 0 && grupos.every((g) => abiertos.has(g.trabajadorId));

  const denied = useRoleGuard(['admin_empresa', 'jefe_nomina']);
  if (denied) return denied;

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['bottom']}>
      <Stack.Screen options={{ title: 'Descansos compensatorios', headerShown: true }} />

      {isLoading ? (
        <SkeletonList style={{ paddingHorizontal: 16, paddingTop: 12 }} />
      ) : (
        <FlatList
          data={grupos}
          keyExtractor={(g) => String(g.trabajadorId)}
          renderItem={({ item }) => (
            <TablaEmpleado grupo={item} abierto={abiertos.has(item.trabajadorId)} onToggle={() => alternar(item.trabajadorId)} />
          )}
          ItemSeparatorComponent={() => <View className="h-3" />}
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
              {/* Resumen: una línea, los contadores finos viven en los filtros */}
              <View className="bg-warning-light rounded-2xl px-4 py-3 flex-row items-center gap-2">
                <Ionicons name="bed-outline" size={18} color={COLORS.warningText} />
                <Text className="flex-1 text-sm font-semibold" style={{ color: COLORS.warningText }}>
                  {pendientes} pendientes · {todos.length} total
                </Text>
                <Text className="text-[11px]" style={{ color: COLORS.warningText }}>Art. 179 CST</Text>
              </View>

              {/* Filtros */}
              <View className="flex-row gap-2">
                {FILTROS.map((f) => (
                  <TouchableOpacity
                    key={f.v}
                    onPress={() => { setFiltro(f.v); setAbiertosUsuario(null); }}
                    accessibilityRole="button"
                    accessibilityState={{ selected: filtro === f.v }}
                    className={[
                      'px-4 py-2 rounded-full border',
                      filtro === f.v
                        ? 'bg-foreground border-foreground'
                        : 'bg-card border-border',
                    ].join(' ')}
                  >
                    <Text className={`text-xs font-semibold ${filtro === f.v ? 'text-white' : 'text-muted-foreground'}`}>
                      {f.label}
                      {f.v !== 'todos' && ` · ${todos.filter((c) => enBucket(c.estado, f.v)).length}`}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {grupos.length > 1 && (
                <TouchableOpacity
                  onPress={() => setAbiertosUsuario(todosAbiertos ? new Set() : new Set(grupos.map((g) => g.trabajadorId)))}
                  accessibilityRole="button"
                  className="self-end flex-row items-center gap-1 py-1"
                >
                  <Ionicons name={todosAbiertos ? 'contract-outline' : 'expand-outline'} size={14} color={COLORS.primary600} />
                  <Text className="text-xs font-semibold" style={{ color: COLORS.primary600 }}>
                    {todosAbiertos ? 'Contraer todo' : 'Expandir todo'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          }
          ListEmptyComponent={
            <EmptyState
              variant={filtro === 'todos' ? 'empty' : filtro === 'pendiente' ? 'done' : 'search'}
              title={filtro === 'todos' ? 'Sin descansos registrados' : `Sin descansos ${filtro === 'pendiente' ? 'pendientes' : 'asignados'}`}
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

// ── Tarjeta plegable de un empleado: resumen plegado, una fila por compensatorio al desplegar ─────

function TablaEmpleado({ grupo: g, abierto, onToggle }: { grupo: GrupoEmpleado; abierto: boolean; onToggle: () => void }) {
  const dias = g.venceMin ? diasParaVencer(g.venceMin, bogotaToday(), true) : null;
  return (
    <Plegable
      abierto={abierto}
      onToggle={onToggle}
      etiqueta={`compensatorios de ${g.nombre}, ${g.pendientes} pendientes`}
      cabecera={
        <View className="gap-1">
          <View className="flex-row items-center justify-between gap-2">
            <Text className="flex-1 text-sm font-bold text-foreground" numberOfLines={1}>{g.nombre}</Text>
            <Text className="text-[11px] text-muted-foreground">
              {g.filas.length} descanso{g.filas.length > 1 ? 's' : ''}
            </Text>
          </View>
          {g.pendientes > 0 && (
            <View className="flex-row items-center gap-3">
              <View className="flex-row items-center gap-1">
                <Ionicons name="bed-outline" size={13} color={COLORS.warningText} />
                <Text className="text-xs font-semibold" style={{ color: COLORS.warningText }}>
                  {g.pendientes} pendiente{g.pendientes > 1 ? 's' : ''}
                </Text>
              </View>
              {dias !== null && (
                <View className="flex-row items-center gap-1">
                  <Ionicons name="time-outline" size={13} color={colorVencimiento(dias)} />
                  <Text className="text-xs font-medium" style={{ color: colorVencimiento(dias) }}>{textoVencimiento(dias)}</Text>
                </View>
              )}
            </View>
          )}
        </View>
      }
    >
      {g.filas.map((c, i) => (
        <View key={c.id} className={i > 0 ? 'border-t border-border' : ''}>
          {c.estado === 'pendiente'
            ? <CompensatorioRow compensatorio={c} sinNombre />
            : <AsignadoRow compensatorio={c} sinNombre />}
        </View>
      ))}
    </Plegable>
  );
}
