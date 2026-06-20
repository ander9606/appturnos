/**
 * ResumenCards — estadísticas del período y selector de períodos.
 *
 * Jerarquía de información:
 *   1. Extra acumulado en pesos   (lo que impacta el bolsillo positivamente)
 *   2. Días registrados           (verificación de completitud)
 *   3. Panel expandible de novedades: horas faltantes + extras (categorías separadas)
 *   4. Desglose de horas con recargo
 *   5. Selector de período (si hay varios)
 */

import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatCOP } from '@/lib/formatters';
import { fmtPeriodo, type ResumenPeriodoNomina } from '../nominaTrabajadorUtils';
import type { PeriodoNomina } from '@api-client';

interface Props {
  resumen:                ResumenPeriodoNomina;
  periodos:               PeriodoNomina[];
  periodoActivoId:        number | undefined;
  onSeleccionarPeriodo:   (id: number) => void;
  valorHora?:             number;
}

export function ResumenCards({
  resumen,
  periodos,
  periodoActivoId,
  onSeleccionarPeriodo,
  valorHora = 0,
}: Props) {
  const [expanded, setExpanded] = useState(false);

  const tieneExtras   = resumen.horasExtraDiurnas > 0 || resumen.horasExtraNocturnas > 0 ||
                        resumen.horasNocturnas > 0    || resumen.horasFestivo > 0;
  const tieneNovedades = resumen.diasCortos > 0 || tieneExtras;

  // Descuento estimado por horas faltantes
  const descuentoEstimado = Math.round(resumen.horasFaltantes * valorHora);

  return (
    <View className="gap-3">
      {/* ── Fila principal: extra $ · días ─────────────────── */}
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
      </View>

      {/* ── Panel expandible de novedades ──────────────────── */}
      {tieneNovedades && (
        <TouchableOpacity
          onPress={() => setExpanded((v) => !v)}
          activeOpacity={0.8}
          className="bg-card border border-border rounded-2xl px-4 py-3 gap-0"
        >
          {/* Header del panel */}
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-2">
              {resumen.diasCortos > 0 && (
                <View className="w-2 h-2 rounded-full bg-warning" />
              )}
              {tieneExtras && (
                <View className="w-2 h-2 rounded-full bg-success" />
              )}
              <Text className="text-sm font-semibold text-foreground">
                Novedades del período
              </Text>
            </View>
            <Ionicons
              name={expanded ? 'chevron-up' : 'chevron-down'}
              size={16}
              color="#64748B"
            />
          </View>

          {/* Resumen comprimido siempre visible */}
          {!expanded && (
            <View className="flex-row gap-4 mt-2">
              {resumen.diasCortos > 0 && (
                <Text className="text-xs text-amber-700">
                  ⚠ {resumen.diasCortos} día{resumen.diasCortos > 1 ? 's' : ''} incompleto{resumen.diasCortos > 1 ? 's' : ''}
                </Text>
              )}
              {tieneExtras && (
                <Text className="text-xs text-success">
                  ↑ {(resumen.horasExtraDiurnas + resumen.horasExtraNocturnas + resumen.horasNocturnas + resumen.horasFestivo).toFixed(1)}h con recargo
                </Text>
              )}
            </View>
          )}

          {/* Detalle expandido */}
          {expanded && (
            <View className="mt-3 gap-3">
              {/* Horas faltantes */}
              {resumen.diasCortos > 0 && (
                <View className="bg-warning-light rounded-xl px-3 py-3 gap-1.5">
                  <Text className="text-xs font-semibold text-amber-800">
                    Horas pendientes
                  </Text>
                  <View className="flex-row items-baseline gap-1">
                    <Text className="text-xl font-extrabold text-amber-700">
                      {resumen.horasFaltantes.toFixed(1)}h
                    </Text>
                    <Text className="text-xs text-amber-600">
                      en {resumen.diasCortos} día{resumen.diasCortos > 1 ? 's' : ''} incompleto{resumen.diasCortos > 1 ? 's' : ''}
                    </Text>
                  </View>
                  {descuentoEstimado > 0 && (
                    <Text className="text-xs text-amber-700">
                      Descuento estimado: -{formatCOP(descuentoEstimado)}
                    </Text>
                  )}
                  <Text className="text-[10px] text-amber-600 mt-0.5">
                    Las horas pendientes y las horas extra son conceptos independientes. Consulta con tu empleador.
                  </Text>
                </View>
              )}

              {/* Horas extra con recargo */}
              {tieneExtras && (
                <View className="bg-primary-50 rounded-xl px-3 py-3 gap-1.5">
                  <Text className="text-xs font-semibold text-primary-600">
                    Horas con recargo
                  </Text>
                  <View className="flex-row flex-wrap gap-x-4 gap-y-2">
                    {resumen.horasExtraDiurnas > 0 && (
                      <HoraChip label="Extra diurna" horas={resumen.horasExtraDiurnas} color="text-primary-500" />
                    )}
                    {resumen.horasExtraNocturnas > 0 && (
                      <HoraChip label="Extra noct." horas={resumen.horasExtraNocturnas} color="text-primary-600" />
                    )}
                    {resumen.horasNocturnas > 0 && (
                      <HoraChip label="Nocturnas" horas={resumen.horasNocturnas} color="text-info" />
                    )}
                    {resumen.horasFestivo > 0 && (
                      <HoraChip label="Festivo" horas={resumen.horasFestivo} color="text-danger" />
                    )}
                  </View>
                  {resumen.valorExtraCOP > 0 && (
                    <Text className="text-xs font-semibold text-success mt-0.5">
                      Total adicional: +{formatCOP(resumen.valorExtraCOP)}
                    </Text>
                  )}
                </View>
              )}
            </View>
          )}
        </TouchableOpacity>
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
