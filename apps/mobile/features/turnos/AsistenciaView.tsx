import React, { useState, useMemo, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { usePeriodos, useRegistros } from '@/features/nomina/useNomina';
import { useTheme } from '@/lib/theme';
import type { PeriodoNomina, RegistroDiario } from '@api-client';

// ── Helpers ───────────────────────────────────────────────────────────────

const SHORT_MONTHS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
const SHORT_DAYS   = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];

function fmtFecha(iso: string) {
  const d = new Date(`${iso}T00:00:00`);
  return `${SHORT_DAYS[d.getDay()]} ${d.getDate()} ${SHORT_MONTHS[d.getMonth()]}`;
}

function fmtHora(t: string | null) {
  if (!t) return '—';
  return t.slice(0, 5).replace(/^0/, '');
}

function totalHoras(r: RegistroDiario): number {
  return (
    Number(r.horas_ordinarias) +
    Number(r.horas_extra_diurnas) +
    Number(r.horas_extra_nocturnas) +
    Number(r.horas_nocturnas) +
    Number(r.horas_festivo)
  );
}

function findPeriodo(periodos: PeriodoNomina[], fecha: string): PeriodoNomina | undefined {
  return periodos.find((p) => fecha >= p.fecha_inicio && fecha <= p.fecha_fin);
}

// ── AsistenciaRow ─────────────────────────────────────────────────────────

function AsistenciaRow({ registro, primaryColor }: { registro: RegistroDiario; primaryColor: string }) {
  const [expanded, setExpanded] = useState(false);
  const total = totalHoras(registro);

  const extras =
    Number(registro.horas_extra_diurnas) +
    Number(registro.horas_extra_nocturnas) +
    Number(registro.horas_nocturnas) +
    Number(registro.horas_festivo);

  return (
    <View
      className="bg-card rounded-2xl overflow-hidden"
      style={{ elevation: 1, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6 }}
    >
      <TouchableOpacity
        className="flex-row"
        onPress={() => setExpanded((v) => !v)}
        activeOpacity={0.75}
      >
        <View className="w-1.5" style={{ backgroundColor: registro.es_festivo ? '#F97316' : primaryColor }} />

        <View className="flex-1 px-4 py-3 gap-1">
          <View className="flex-row items-center justify-between">
            <Text className="text-sm font-semibold text-foreground flex-1 mr-2" numberOfLines={1}>
              {registro.trabajador_nombre} {registro.trabajador_apellido}
            </Text>
            <Text className="text-lg text-muted-foreground">{expanded ? '▲' : '▼'}</Text>
          </View>

          <View className="flex-row items-center gap-3">
            <Text className="text-xs text-muted-foreground">
              🕐 {fmtHora(registro.hora_entrada)} – {fmtHora(registro.hora_salida)}
            </Text>
            <Text className="text-xs font-bold" style={{ color: primaryColor }}>
              {total.toFixed(1)}h
            </Text>
            {extras > 0 && (
              <View className="bg-warning-light px-2 py-0.5 rounded-full">
                <Text className="text-[10px] font-semibold text-amber-700">
                  +{extras.toFixed(1)}h recargo
                </Text>
              </View>
            )}
            {registro.es_festivo ? (
              <View className="bg-orange-100 px-2 py-0.5 rounded-full">
                <Text className="text-[10px] font-semibold text-orange-700">Festivo</Text>
              </View>
            ) : null}
          </View>

          {registro.novedad ? (
            <Text className="text-xs text-muted-foreground italic" numberOfLines={1}>
              📝 {registro.novedad}
            </Text>
          ) : null}
        </View>
      </TouchableOpacity>

      {expanded && (
        <View className="px-4 pb-3 border-t border-border">
          <View className="flex-row flex-wrap gap-x-5 gap-y-1.5 mt-3">
            {Number(registro.horas_ordinarias) > 0 && (
              <HoraChip label="Ordinarias" value={Number(registro.horas_ordinarias)} color="text-foreground" />
            )}
            {Number(registro.horas_extra_diurnas) > 0 && (
              <HoraChip label="Extra diurna" value={Number(registro.horas_extra_diurnas)} color="text-warning" />
            )}
            {Number(registro.horas_extra_nocturnas) > 0 && (
              <HoraChip label="Extra noct." value={Number(registro.horas_extra_nocturnas)} color="text-warning" />
            )}
            {Number(registro.horas_nocturnas) > 0 && (
              <HoraChip label="Nocturnas" value={Number(registro.horas_nocturnas)} color="text-info" />
            )}
            {Number(registro.horas_festivo) > 0 && (
              <HoraChip label="Festivo" value={Number(registro.horas_festivo)} color="text-danger" />
            )}
          </View>
        </View>
      )}
    </View>
  );
}

function HoraChip({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View className="gap-0.5">
      <Text className={`text-sm font-bold ${color}`}>{value.toFixed(1)}h</Text>
      <Text className="text-[10px] text-muted-foreground">{label}</Text>
    </View>
  );
}

// ── AsistenciaView ────────────────────────────────────────────────────────

interface Props {
  selectedDate: string;
}

export function AsistenciaView({ selectedDate }: Props) {
  const theme = useTheme();

  const { data: periodosResp, isLoading: loadingPeriodos } = usePeriodos();
  const periodos = useMemo(() => periodosResp?.data ?? [], [periodosResp]);
  const periodo  = useMemo(() => findPeriodo(periodos, selectedDate), [periodos, selectedDate]);

  const {
    data: registrosResp,
    isLoading: loadingRegistros,
    isError,
    refetch,
    isRefetching,
  } = useRegistros({ periodo_id: periodo?.id, fecha: selectedDate, limit: 100 });

  const registros = useMemo(() => registrosResp?.data ?? [], [registrosResp]);

  const totales = useMemo(
    () => registros.reduce(
      (acc, r) => ({ empleados: acc.empleados + 1, horas: acc.horas + totalHoras(r) }),
      { empleados: 0, horas: 0 }
    ),
    [registros]
  );

  const onRefresh = useCallback(() => { refetch(); }, [refetch]);

  const isLoading = loadingPeriodos || loadingRegistros;

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  if (isError) {
    return (
      <View className="flex-1 items-center justify-center gap-3 px-6">
        <Text className="text-4xl">⚠️</Text>
        <Text className="text-base font-semibold text-foreground">Error al cargar registros</Text>
        <TouchableOpacity
          onPress={() => refetch()}
          className="bg-card border border-border px-5 py-2.5 rounded-2xl"
        >
          <Text className="text-sm font-medium text-foreground">Reintentar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <FlatList
      data={registros}
      keyExtractor={(item) => String(item.id)}
      renderItem={({ item }) => (
        <AsistenciaRow registro={item} primaryColor={theme.primary} />
      )}
      contentContainerClassName="gap-2 pb-8"
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={onRefresh}
          tintColor={theme.primary}
          colors={[theme.primary]}
        />
      }
      ListHeaderComponent={
        periodo ? (
          <View className="pb-3 gap-1.5">
            <View className="flex-row items-center justify-between">
              <Text className="text-sm font-semibold text-foreground">
                {fmtFecha(selectedDate)}
              </Text>
              <View className="bg-muted px-2.5 py-1 rounded-full">
                <Text className="text-[10px] font-medium text-muted-foreground">
                  Período {periodo.fecha_inicio.slice(5).replace('-', '/')} – {periodo.fecha_fin.slice(5).replace('-', '/')}
                </Text>
              </View>
            </View>
            {registros.length > 0 && (
              <View className="flex-row gap-3">
                <Text className="text-xs text-muted-foreground">
                  {totales.empleados} empleado{totales.empleados !== 1 ? 's' : ''}
                </Text>
                <Text className="text-xs text-muted-foreground">
                  {totales.horas.toFixed(1)} h en total
                </Text>
              </View>
            )}
          </View>
        ) : null
      }
      ListEmptyComponent={
        <View className="py-16 items-center gap-3 px-8">
          <Text className="text-4xl">📋</Text>
          <Text className="text-base font-semibold text-foreground text-center">
            {periodo ? 'Sin registros este día' : 'Sin período activo'}
          </Text>
          <Text className="text-sm text-muted-foreground text-center">
            {periodo
              ? `No hay registros de asistencia el ${fmtFecha(selectedDate)}.`
              : 'Este día no pertenece a ningún período de nómina abierto.'}
          </Text>
        </View>
      }
      ItemSeparatorComponent={() => <View className="h-2" />}
      contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16 }}
    />
  );
}
