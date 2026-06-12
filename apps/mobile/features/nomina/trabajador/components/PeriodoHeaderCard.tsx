/**
 * PeriodoHeaderCard — cabecera coloreada del período de nómina.
 *
 * Muestra:
 *   • Rango del período + badge de estado
 *   • Salario base + valor/hora + chip de extras en pesos
 *   • Estado del día actual (entrada / salida / transcurrido / horas)
 *   • Resumen semanal
 */

import React from 'react';
import { View, Text } from 'react-native';
import { PeriodoBadge } from '../../PeriodoBadge';
import { formatCOP } from '@/lib/formatters';
import {
  fmtPeriodo,
  fmtHora,
  calcularElapsedLabel,
  analizarDia,
  type EstadoHoy,
  type ResumenPeriodoNomina,
} from '../nominaTrabajadorUtils';
import type { PeriodoNomina, RegistroDiario } from '@api-client';

interface Props {
  periodo:     PeriodoNomina | undefined;
  registroHoy: RegistroDiario | null;
  estadoHoy:   EstadoHoy;
  resumen:     ResumenPeriodoNomina;
  resumenSemana: ResumenPeriodoNomina;
  salarioBase: number | null;
  valorHora:   number;
  color:       string;  // theme.primary
  todayLabel:  string;  // "Lun 9 Jun"
}

export function PeriodoHeaderCard({
  periodo,
  registroHoy,
  estadoHoy,
  resumen,
  resumenSemana,
  salarioBase,
  valorHora,
  color,
  todayLabel,
}: Props) {
  const analisisHoy = registroHoy ? analizarDia(registroHoy, valorHora) : null;

  return (
    <View
      className="pt-4 pb-6 px-6 rounded-b-[28px] gap-3"
      style={{ backgroundColor: color }}
    >
      {/* ── Encabezado período ─────────────────────────────── */}
      <View className="flex-row items-start justify-between">
        <View className="gap-1 flex-1">
          <Text className="text-white/80 text-xs font-medium uppercase tracking-wide">
            Mi Nómina
          </Text>
          <Text className="text-white text-xl font-bold">
            {periodo ? fmtPeriodo(periodo) : '—'}
          </Text>
          {periodo && <PeriodoBadge estado={periodo.estado} />}
        </View>
      </View>

      {/* ── Card salario + extras ──────────────────────────── */}
      <View className="bg-white/20 rounded-2xl px-4 py-3 flex-row items-center gap-3">
        <View className="flex-1 gap-0.5">
          <Text className="text-white text-lg font-extrabold">
            {salarioBase != null ? formatCOP(salarioBase) : '—'}
          </Text>
          <Text className="text-white/70 text-[10px]">Salario mensual</Text>
        </View>

        {salarioBase != null && (
          <View className="gap-0.5 items-end">
            <Text className="text-white text-sm font-bold">
              {formatCOP(Math.round(valorHora))} / h
            </Text>
            <Text className="text-white/70 text-[10px]">Valor hora</Text>
          </View>
        )}

        {resumen.valorExtraCOP > 0 && (
          <View className="bg-white/25 rounded-xl px-2.5 py-1.5 gap-0.5 items-center">
            <Text className="text-white text-sm font-extrabold">
              +{formatCOP(resumen.valorExtraCOP)}
            </Text>
            <Text className="text-white/70 text-[9px]">Extra período</Text>
          </View>
        )}
      </View>

      {/* ── Card estado hoy ─────────────────────────────────── */}
      <View className="bg-white/15 rounded-2xl px-4 py-3 gap-1.5">
        <Text className="text-white/80 text-xs font-medium">{todayLabel}</Text>
        <View className="flex-row items-center gap-4">
          <View className="gap-0.5">
            <Text className="text-white text-sm font-bold">
              {fmtHora(registroHoy?.hora_entrada)}
            </Text>
            <Text className="text-white/60 text-[10px]">Entrada</Text>
          </View>

          <Text className="text-white/40">→</Text>

          <View className="gap-0.5">
            <Text className="text-white text-sm font-bold">
              {fmtHora(registroHoy?.hora_salida)}
            </Text>
            <Text className="text-white/60 text-[10px]">Salida</Text>
          </View>

          {estadoHoy === 'en_jornada' && registroHoy?.hora_entrada && (
            <>
              <Text className="text-white/40">·</Text>
              <View className="gap-0.5">
                <Text className="text-white text-sm font-bold">
                  {calcularElapsedLabel(registroHoy.hora_entrada)}
                </Text>
                <Text className="text-white/60 text-[10px]">Transcurrido</Text>
              </View>
            </>
          )}

          {estadoHoy === 'jornada_completa' && analisisHoy && (
            <>
              <Text className="text-white/40">·</Text>
              <View className="gap-0.5">
                <Text className="text-white text-sm font-bold">
                  {analisisHoy.totalHoras.toFixed(1)}h
                </Text>
                <Text className="text-white/60 text-[10px]">Trabajadas</Text>
              </View>
              {analisisHoy.valorExtraCOP > 0 && (
                <>
                  <Text className="text-white/40">·</Text>
                  <View className="gap-0.5">
                    <Text className="text-white text-sm font-bold">
                      +{formatCOP(analisisHoy.valorExtraCOP)}
                    </Text>
                    <Text className="text-white/60 text-[10px]">Extra hoy</Text>
                  </View>
                </>
              )}
            </>
          )}
        </View>
      </View>

      {/* ── Card semana ─────────────────────────────────────── */}
      <View className="bg-white/10 rounded-2xl px-4 py-3 flex-row gap-4">
        <View className="gap-0.5 flex-1">
          <Text className="text-white text-base font-extrabold">
            {resumenSemana.totalHoras.toFixed(1)}h
          </Text>
          <Text className="text-white/70 text-[10px]">Esta semana</Text>
        </View>

        {resumenSemana.valorExtraCOP > 0 && (
          <View className="gap-0.5 flex-1">
            <Text className="text-white text-base font-extrabold">
              +{formatCOP(resumenSemana.valorExtraCOP)}
            </Text>
            <Text className="text-white/70 text-[10px]">Extra sem.</Text>
          </View>
        )}

        <View className="gap-0.5 flex-1">
          <Text className="text-white text-base font-extrabold">
            {resumenSemana.diasRegistrados}d
          </Text>
          <Text className="text-white/70 text-[10px]">Días sem.</Text>
        </View>
      </View>
    </View>
  );
}
