/**
 * PeriodoHeaderCard — cabecera coloreada del período de nómina.
 *
 * Muestra:
 *   • Rango del período + badge de estado
 *   • Salario base + valor/hora + chip de extras en pesos
 *   • Estado del día actual (entrada / salida / transcurrido / horas)
 *   • Resumen semanal
 */

import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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
  onVerDetalles?: () => void;
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
  onVerDetalles,
}: Props) {
  const [visible, setVisible] = useState(false);
  const analisisHoy = registroHoy ? analizarDia(registroHoy, valorHora) : null;
  const mask = (v: string) => (visible ? v : '••••••');

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
            {salarioBase != null ? mask(formatCOP(salarioBase)) : '—'}
          </Text>
          <Text className="text-white/70 text-[10px]">Salario mensual</Text>
        </View>

        {resumen.valorExtraCOP > 0 && (
          <View className="bg-white/25 rounded-xl px-2.5 py-1.5 gap-0.5 items-center">
            <Text className="text-white text-sm font-extrabold">
              +{mask(formatCOP(resumen.valorExtraCOP))}
            </Text>
            <Text className="text-white/70 text-[9px]">Extra período</Text>
          </View>
        )}

        <TouchableOpacity
          onPress={() => setVisible((v) => !v)}
          hitSlop={8}
          accessibilityLabel={visible ? 'Ocultar salario' : 'Mostrar salario'}
        >
          <Ionicons name={visible ? 'eye-off-outline' : 'eye-outline'} size={18} color="rgba(255,255,255,0.8)" />
        </TouchableOpacity>
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
                      +{mask(formatCOP(analisisHoy.valorExtraCOP))}
                    </Text>
                    <Text className="text-white/60 text-[10px]">Extra hoy</Text>
                  </View>
                </>
              )}
            </>
          )}
        </View>
      </View>

      {/* ── Barra de horas semanales ────────────────────────── */}
      {(() => {
        const semana      = resumenSemana.semanas[0];
        const limite      = semana?.limiteHoras ?? 40;
        const totalH      = resumenSemana.totalHoras;
        const extraH      = resumenSemana.horasExtraDiurnas + resumenSemana.horasExtraNocturnas;
        const ordinH      = Math.max(0, totalH - extraH);
        const pctOrdin    = Math.min(100, (ordinH / limite) * 100);
        const pctExtra    = Math.min(100 - pctOrdin, (extraH / limite) * 100);
        const hayExtras   = extraH > 0;

        return (
          <View className="bg-white/10 rounded-2xl px-4 py-3 gap-2">
            {/* Cabecera: horas + label */}
            <View className="flex-row items-baseline justify-between">
              <View className="flex-row items-baseline gap-1">
                <Text className="text-white text-base font-extrabold">
                  {totalH.toFixed(1)}h
                </Text>
                <Text className="text-white/60 text-[10px]">
                  / {limite}h esta semana
                </Text>
                {hayExtras && (
                  <View className="ml-1 bg-amber-400/30 rounded-full px-1.5 py-0.5">
                    <Text className="text-amber-200 text-[9px] font-bold">
                      +{extraH.toFixed(1)}h extra
                    </Text>
                  </View>
                )}
              </View>
              {onVerDetalles && (
                <TouchableOpacity onPress={onVerDetalles} hitSlop={8}>
                  <Text className="text-white/70 text-[10px] font-semibold underline">
                    Ver detalles
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Barra dos colores */}
            <View className="h-2.5 bg-white/20 rounded-full overflow-hidden flex-row">
              {pctOrdin > 0 && (
                <View
                  className="h-full rounded-full"
                  style={{ width: `${pctOrdin}%`, backgroundColor: 'rgba(255,255,255,0.85)' }}
                />
              )}
              {pctExtra > 0 && (
                <View
                  className="h-full"
                  style={{ width: `${pctExtra}%`, backgroundColor: '#F59E0B' }}
                />
              )}
            </View>

            {/* Extras en pesos si hay */}
            {hayExtras && resumenSemana.valorExtraCOP > 0 && (
              <Text className="text-amber-200 text-[10px] font-semibold">
                +{mask(formatCOP(resumenSemana.valorExtraCOP))} por extras esta semana
              </Text>
            )}
          </View>
        );
      })()}
    </View>
  );
}
