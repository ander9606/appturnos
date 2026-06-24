/**
 * DashboardAsistencia — vista en tiempo casi-real del gestor.
 *
 * Muestra quién está en jornada, quién completó y quién falta hoy,
 * con horas acumuladas en la semana vs límite legal (Ley 2101).
 */

import React, { useState } from 'react';
import {
  View, Text, FlatList, ActivityIndicator,
  TouchableOpacity, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '@/lib/theme';
import { getInitials } from '@/lib/formatters';
import {
  useDashboardAsistencia,
  type FilaDashboard,
  type EstadoAsistencia,
} from '@/features/nomina/gestor/useDashboardAsistencia';
import { TIPO_DIA_LABEL } from '@/features/nomina/trabajador/nominaTrabajadorUtils';

// ── Config visual por estado ──────────────────────────────────────────────

const ESTADO_CONFIG: Record<EstadoAsistencia, {
  label: string; dot: string; badge: string; badgeText: string;
}> = {
  en_jornada: {
    label:     'En jornada',
    dot:       '#22C55E',
    badge:     'bg-green-100',
    badgeText: 'text-green-700',
  },
  completo: {
    label:     'Completó',
    dot:       '#6366F1',
    badge:     'bg-indigo-50',
    badgeText: 'text-indigo-600',
  },
  ausente: {
    label:     'Sin registro',
    dot:       '#EF4444',
    badge:     'bg-red-50',
    badgeText: 'text-danger',
  },
  especial: {
    label:     'Día especial',
    dot:       '#F59E0B',
    badge:     'bg-warning-light',
    badgeText: 'text-amber-700',
  },
};

type Filtro = 'todos' | EstadoAsistencia;

// ── Fila de trabajador ────────────────────────────────────────────────────

function FilaTrabajador({ fila }: { fila: FilaDashboard }) {
  const cfg         = ESTADO_CONFIG[fila.estado];
  const tipoDiaLabel = fila.registroHoy?.tipo_dia && fila.registroHoy.tipo_dia !== 'ordinario'
    ? TIPO_DIA_LABEL[fila.registroHoy.tipo_dia]
    : null;

  const horario = fila.horaEntrada
    ? `${fila.horaEntrada} → ${fila.horaSalida ?? '…'}`
    : null;

  const excedeSemana = fila.horasExtra > 0;

  return (
    <View
      className="bg-card rounded-2xl px-4 py-3 flex-row items-center gap-3"
      style={{ elevation: 1, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6 }}
    >
      {/* Avatar */}
      <View className="w-10 h-10 rounded-full bg-primary/10 items-center justify-center flex-shrink-0">
        <Text className="text-sm font-bold text-primary">
          {getInitials(fila.trabajador.nombre, fila.trabajador.apellido)}
        </Text>
      </View>

      {/* Centro */}
      <View className="flex-1 gap-0.5">
        <Text className="text-sm font-semibold text-foreground" numberOfLines={1}>
          {fila.trabajador.nombre} {fila.trabajador.apellido}
        </Text>

        {tipoDiaLabel ? (
          <Text className="text-xs text-amber-600">{tipoDiaLabel}</Text>
        ) : horario ? (
          <Text className="text-xs text-muted-foreground">{horario}</Text>
        ) : null}

        {/* Barra de horas semanales (dos colores: azul = ordinarias, naranja = extras) */}
        {(() => {
          const ordinH   = Math.max(0, fila.horasSemana - fila.horasExtra);
          const pctOrdin = Math.min(100, (ordinH / fila.limiteSemana) * 100);
          const pctExtra = Math.min(100 - pctOrdin, (fila.horasExtra / fila.limiteSemana) * 100);
          return (
            <View className="gap-1 mt-1">
              <View className="h-2 bg-muted rounded-full overflow-hidden flex-row">
                {pctOrdin > 0 && (
                  <View className="h-full bg-primary/60 rounded-full" style={{ width: `${pctOrdin}%` }} />
                )}
                {pctExtra > 0 && (
                  <View className="h-full" style={{ width: `${pctExtra}%`, backgroundColor: '#F59E0B' }} />
                )}
              </View>
              <Text className={`text-[10px] font-semibold ${excedeSemana ? 'text-amber-600' : 'text-muted-foreground'}`}>
                {fila.horasSemana}h
                {excedeSemana ? ` (+${fila.horasExtra}h extra)` : ` / ${fila.limiteSemana}h`}
              </Text>
            </View>
          );
        })()}
      </View>

      {/* Estado badge */}
      <View className="items-end gap-1">
        <View className={`flex-row items-center gap-1.5 px-2 py-1 rounded-full ${cfg.badge}`}>
          <View className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: cfg.dot }} />
          <Text className={`text-[10px] font-semibold ${cfg.badgeText}`}>{cfg.label}</Text>
        </View>
        {fila.registroHoy?.novedad && (
          <Ionicons name="chatbox-ellipses-outline" size={12} color="#94A3B8" />
        )}
      </View>
    </View>
  );
}

// ── Pantalla principal ────────────────────────────────────────────────────

const FILTROS: { v: Filtro; label: string }[] = [
  { v: 'todos',      label: 'Todos'      },
  { v: 'en_jornada', label: 'En jornada' },
  { v: 'ausente',    label: 'Ausentes'   },
  { v: 'completo',   label: 'Completos'  },
  { v: 'especial',   label: 'Especiales' },
];

const SHORT_DAYS   = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
const SHORT_MONTHS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

export default function DashboardAsistenciaScreen() {
  const theme = useTheme();
  const [filtro, setFiltro] = useState<Filtro>('todos');

  const {
    filas, contadores, hoy, limiteSemana,
    isLoading, isRefetching, refetch,
  } = useDashboardAsistencia();

  const filasFiltradas = filtro === 'todos'
    ? filas
    : filas.filter((f) => f.estado === filtro);

  const d = new Date(`${hoy}T12:00:00`);
  const labelHoy = `${SHORT_DAYS[d.getDay()]} ${d.getDate()} ${SHORT_MONTHS[d.getMonth()]}`;
  const presentes = contadores.enJornada + contadores.completos;

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center" edges={['bottom']}>
        <Stack.Screen options={{ title: 'Asistencia hoy', headerShown: true }} />
        <ActivityIndicator size="large" color={theme.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['bottom']}>
      <Stack.Screen options={{ title: 'Asistencia hoy', headerShown: true }} />

      <FlatList
        data={filasFiltradas}
        keyExtractor={(f) => String(f.trabajador.id)}
        renderItem={({ item }) => <FilaTrabajador fila={item} />}
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
            {/* ── Header card ── */}
            <View className="bg-primary rounded-2xl px-5 py-4 gap-1">
              <Text className="text-white/75 text-xs font-medium">{labelHoy}</Text>
              <View className="flex-row items-baseline gap-2">
                <Text className="text-white text-3xl font-extrabold">{presentes}</Text>
                <Text className="text-white/80 text-base">/ {contadores.total} presentes</Text>
              </View>
              {/* Contadores rápidos */}
              <View className="flex-row gap-4 mt-1">
                <CounterPill color="#22C55E" label={`${contadores.enJornada} en jornada`} />
                <CounterPill color="#EF4444" label={`${contadores.ausentes} ausentes`} />
                {contadores.especiales > 0 && (
                  <CounterPill color="#F59E0B" label={`${contadores.especiales} especial`} />
                )}
              </View>
              <Text className="text-white/60 text-[10px] mt-1">
                Límite semanal {new Date().getFullYear()}: {limiteSemana}h · Ley 2101
              </Text>
            </View>

            {/* ── Tabs de filtro ── */}
            <FlatList
              horizontal
              data={FILTROS}
              keyExtractor={(f) => f.v}
              showsHorizontalScrollIndicator={false}
              renderItem={({ item: f }) => (
                <TouchableOpacity
                  onPress={() => setFiltro(f.v)}
                  className={[
                    'px-4 py-2 rounded-full border mr-2',
                    filtro === f.v
                      ? 'bg-foreground border-foreground'
                      : 'bg-card border-border',
                  ].join(' ')}
                >
                  <Text className={`text-xs font-semibold ${filtro === f.v ? 'text-white' : 'text-muted-foreground'}`}>
                    {f.label}
                    {f.v !== 'todos' && ` · ${filas.filter((r) => f.v === 'todos' || r.estado === f.v).length}`}
                  </Text>
                </TouchableOpacity>
              )}
              contentContainerStyle={{ paddingVertical: 2 }}
            />
          </View>
        }
        ListEmptyComponent={
          <View className="py-16 items-center gap-3 px-8">
            <Ionicons name="people-outline" size={40} color="#94A3B8" />
            <Text className="text-base font-semibold text-foreground text-center">
              {filtro === 'todos' ? 'Sin trabajadores de nómina' : 'Sin resultados para este filtro'}
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

function CounterPill({ color, label }: { color: string; label: string }) {
  return (
    <View className="flex-row items-center gap-1">
      <View className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
      <Text className="text-white/80 text-xs">{label}</Text>
    </View>
  );
}
