/**
 * ResumenCards — estadísticas del período y selector de períodos.
 *
 * Jerarquía de información:
 *   1. Extra acumulado en pesos   (lo que impacta el bolsillo)
 *   2. Días registrados           (verificación de completitud)
 *   3. Total horas                (referencia, secundario)
 *   4. Alertas: días cortos       (posibles descuentos)
 *   5. Desglose de horas con recargo
 *   6. Selector de período (si hay varios abiertos)
 */

import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { formatCOP } from '@/lib/formatters';
import { fmtPeriodo, type ResumenPeriodoNomina } from '../nominaTrabajadorUtils';
import type { PeriodoNomina } from '@api-client';

interface Props {
  resumen:                ResumenPeriodoNomina;
  periodos:               PeriodoNomina[];
  periodoActivoId:        number | undefined;
  onSeleccionarPeriodo:   (id: number) => void;
}

export function ResumenCards({
  resumen,
  periodos,
  periodoActivoId,
  onSeleccionarPeriodo,
}: Props) {
  const tieneExtras = resumen.horasExtraDiurnas > 0 || resumen.horasExtraNocturnas > 0 ||
                      resumen.horasNocturnas > 0    || resumen.horasFestivo > 0;

  return (
    <View className="gap-3">
      {/* ── Fila principal: extra $ · días · horas ─────────── */}
      <View className="flex-row gap-2">
        <StatCard
          label="Extra período"
          value={resumen.valorExtraCOP > 0 ? `+${formatCOP(resumen.valorExtraCOP)}` : '$0'}
          valueClass={resumen.valorExtraCOP > 0 ? 'text-success' : 'text-muted-foreground'}
        />
        <StatCard
          label="Días regist."
          value={String(resumen.diasRegistrados)}
          valueClass="text-foreground"
        />
        <StatCard
          label="Total horas"
          value={`${resumen.totalHoras.toFixed(1)}h`}
          valueClass="text-muted-foreground"
        />
      </View>

      {/* ── Alerta días cortos ────────────────────────────── */}
      {resumen.diasCortos > 0 && (
        <View className="bg-warning-light border border-amber-200 rounded-2xl px-4 py-3 flex-row items-center gap-3">
          <Text className="text-base">⚠️</Text>
          <View className="flex-1">
            <Text className="text-xs font-semibold text-amber-800">
              {resumen.diasCortos} día{resumen.diasCortos > 1 ? 's' : ''} con jornada incompleta
            </Text>
            <Text className="text-xs text-amber-700 mt-0.5">
              Pueden generar descuento en tu salario
            </Text>
          </View>
        </View>
      )}

      {/* ── Desglose horas con recargo ─────────────────────── */}
      {tieneExtras && (
        <View className="bg-primary-50 rounded-2xl px-4 py-3 gap-2">
          <Text className="text-xs font-semibold text-primary-600">Horas con recargo</Text>
          <View className="flex-row flex-wrap gap-4">
            {resumen.horasExtraDiurnas > 0 && (
              <HoraChip
                label="Extra diurna"
                horas={resumen.horasExtraDiurnas}
                color="text-primary-500"
              />
            )}
            {resumen.horasExtraNocturnas > 0 && (
              <HoraChip
                label="Extra noct."
                horas={resumen.horasExtraNocturnas}
                color="text-primary-600"
              />
            )}
            {resumen.horasNocturnas > 0 && (
              <HoraChip
                label="Nocturnas"
                horas={resumen.horasNocturnas}
                color="text-info"
              />
            )}
            {resumen.horasFestivo > 0 && (
              <HoraChip
                label="Festivo"
                horas={resumen.horasFestivo}
                color="text-danger"
              />
            )}
          </View>
        </View>
      )}

      {/* ── Selector de período ───────────────────────────── */}
      {periodos.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View className="flex-row gap-2 py-0.5">
            {periodos.map((p) => (
              <TouchableOpacity
                key={p.id}
                onPress={() => onSeleccionarPeriodo(p.id)}
                className={[
                  'px-3 py-1.5 rounded-full border',
                  p.id === periodoActivoId
                    ? 'bg-foreground border-foreground'
                    : 'bg-card border-border',
                ].join(' ')}
              >
                <Text className={`text-xs font-medium ${
                  p.id === periodoActivoId ? 'text-white' : 'text-foreground'
                }`}>
                  {fmtPeriodo(p)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

// ── Primitivos locales ────────────────────────────────────────────────────

type ColorToken = 'text-foreground' | 'text-muted-foreground' | 'text-success' |
                  'text-primary-500' | 'text-primary-600' | 'text-info' | 'text-danger';

function StatCard({ label, value, valueClass }: { label: string; value: string; valueClass: ColorToken | string }) {
  return (
    <View
      className="flex-1 bg-card rounded-2xl px-3 py-3 gap-0.5"
      style={{ elevation: 1, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6 }}
    >
      <Text className={`text-base font-extrabold ${valueClass}`}>{value}</Text>
      <Text className="text-[10px] text-muted-foreground">{label}</Text>
    </View>
  );
}

function HoraChip({ label, horas, color }: { label: string; horas: number; color: ColorToken }) {
  return (
    <View className="gap-0.5">
      <Text className={`text-sm font-bold ${color}`}>{horas.toFixed(1)}h</Text>
      <Text className="text-[10px] text-muted-foreground">{label}</Text>
    </View>
  );
}
