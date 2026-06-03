/**
 * Vista semanal de asistencia para trabajador_nomina.
 * Muestra los 7 días de la semana con entrada/salida de cada registro.
 */
import React, { useMemo } from 'react';
import { View, Text, ActivityIndicator, ScrollView, RefreshControl } from 'react-native';

import { usePeriodos, useRegistros } from '@/features/nomina/useNomina';
import { useTheme } from '@/lib/theme';
import { getWeekDays } from '@/features/turnos/turnosUtils';
import type { RegistroDiario } from '@api-client';

// ── Helpers ───────────────────────────────────────────────────────────────

function fmtHora(t: string | null | undefined): string {
  if (!t) return '—';
  return t.slice(0, 5);
}

function totalHorasRegistro(r: RegistroDiario): number {
  return (
    Number(r.horas_ordinarias) +
    Number(r.horas_extra_diurnas) +
    Number(r.horas_extra_nocturnas) +
    Number(r.horas_nocturnas) +
    Number(r.horas_festivo)
  );
}

// ── DayRow ────────────────────────────────────────────────────────────────

interface DayRowProps {
  isoDate: string;
  dayLabel: string;
  dayNum: number;
  monthLabel: string;
  isToday: boolean;
  registro: RegistroDiario | null;
  primaryColor: string;
}

function DayRow({ isoDate, dayLabel, dayNum, monthLabel, isToday, registro, primaryColor }: DayRowProps) {
  const tieneEntrada = !!registro?.hora_entrada;
  const tieneSalida  = !!registro?.hora_salida;
  const enTurno      = tieneEntrada && !tieneSalida;
  const completado   = tieneEntrada && tieneSalida;

  const dotColor = completado
    ? '#059669'   // success
    : enTurno
    ? primaryColor
    : '#CBD5E1';  // muted

  return (
    <View
      className="bg-card rounded-2xl flex-row items-center overflow-hidden"
      style={{ elevation: 1, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6 }}
    >
      {/* Indicador lateral */}
      <View
        className="w-1 self-stretch"
        style={{ backgroundColor: completado ? '#059669' : enTurno ? primaryColor : '#E2E8F0' }}
      />

      {/* Día */}
      <View
        className="w-14 items-center py-3 px-1"
        style={isToday ? { backgroundColor: primaryColor + '15' } : undefined}
      >
        <Text
          className="text-[10px] font-semibold uppercase"
          style={{ color: isToday ? primaryColor : '#64748B' }}
        >
          {dayLabel}
        </Text>
        <Text
          className="text-lg font-bold"
          style={{ color: isToday ? primaryColor : '#0F172A' }}
        >
          {dayNum}
        </Text>
        <Text
          className="text-[9px]"
          style={{ color: isToday ? primaryColor + 'AA' : '#94A3B8' }}
        >
          {monthLabel}
        </Text>
      </View>

      {/* Contenido */}
      <View className="flex-1 px-4 py-3 gap-1">
        {!tieneEntrada ? (
          <Text className="text-sm text-muted-foreground italic">Sin registro</Text>
        ) : (
          <>
            <View className="flex-row items-center gap-3">
              <View className="flex-row items-center gap-1.5">
                <Text className="text-xs text-muted-foreground">Entrada</Text>
                <Text className="text-sm font-semibold text-foreground">
                  {fmtHora(registro?.hora_entrada)}
                </Text>
              </View>
              <Text className="text-muted-foreground">→</Text>
              <View className="flex-row items-center gap-1.5">
                <Text className="text-xs text-muted-foreground">Salida</Text>
                <Text className="text-sm font-semibold text-foreground">
                  {fmtHora(registro?.hora_salida)}
                </Text>
              </View>
            </View>

            {enTurno && (
              <View className="flex-row items-center gap-1.5">
                <View className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: primaryColor }} />
                <Text className="text-xs font-medium" style={{ color: primaryColor }}>
                  En turno
                </Text>
              </View>
            )}

            {completado && registro && (
              <View className="flex-row items-center gap-3 flex-wrap">
                <Text className="text-xs font-semibold text-success">
                  {totalHorasRegistro(registro).toFixed(1)}h trabajadas
                </Text>
                {(Number(registro.horas_extra_diurnas) + Number(registro.horas_extra_nocturnas)) > 0 && (
                  <View className="bg-warning-light px-2 py-0.5 rounded-full">
                    <Text className="text-[10px] font-semibold text-amber-700">
                      +{(Number(registro.horas_extra_diurnas) + Number(registro.horas_extra_nocturnas)).toFixed(1)}h extra
                    </Text>
                  </View>
                )}
                {registro.es_festivo ? (
                  <View className="bg-orange-100 px-2 py-0.5 rounded-full">
                    <Text className="text-[10px] font-semibold text-orange-700">Festivo</Text>
                  </View>
                ) : null}
              </View>
            )}
          </>
        )}
      </View>

      {/* Dot indicador derecha */}
      <View className="pr-4">
        <View className="w-2 h-2 rounded-full" style={{ backgroundColor: dotColor }} />
      </View>
    </View>
  );
}

// ── NominaAsistenciaSemanalView ───────────────────────────────────────────

interface Props {
  selectedDate: string;
  weekDays: ReturnType<typeof getWeekDays>;
}

export function NominaAsistenciaSemanalView({ selectedDate, weekDays }: Props) {
  const theme = useTheme();

  const { data: periodosResp, isLoading: loadingPeriodos } = usePeriodos('abierto');
  const periodos = periodosResp?.data ?? [];

  // Encuentra el período que contiene algún día de la semana actual
  const periodo = useMemo(() => {
    for (const day of weekDays) {
      const p = periodos.find(
        (p) => day.isoDate >= p.fecha_inicio && day.isoDate <= p.fecha_fin
      );
      if (p) return p;
    }
    return null;
  }, [periodos, weekDays]);

  const {
    data: registrosResp,
    isLoading: loadingRegistros,
    refetch,
    isRefetching,
  } = useRegistros({ periodo_id: periodo?.id, limit: 100 });

  const registros = registrosResp?.data ?? [];

  // Mapa fecha → registro para lookup rápido
  const registrosPorFecha = useMemo(() => {
    const map = new Map<string, RegistroDiario>();
    for (const r of registros) map.set(r.fecha, r);
    return map;
  }, [registros]);

  if (loadingPeriodos || loadingRegistros) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      className="flex-1"
      contentContainerStyle={{ padding: 16, gap: 8 }}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={refetch}
          tintColor={theme.primary}
          colors={[theme.primary]}
        />
      }
    >
      {!periodo && (
        <View className="bg-muted rounded-2xl px-4 py-3 mb-2">
          <Text className="text-xs text-muted-foreground text-center">
            Esta semana no pertenece a un período de nómina abierto
          </Text>
        </View>
      )}

      {weekDays.map((day) => (
        <DayRow
          key={day.isoDate}
          isoDate={day.isoDate}
          dayLabel={day.dayLabel}
          dayNum={day.dayNum}
          monthLabel={day.monthLabel}
          isToday={day.isToday}
          registro={registrosPorFecha.get(day.isoDate) ?? null}
          primaryColor={theme.primary}
        />
      ))}
    </ScrollView>
  );
}
