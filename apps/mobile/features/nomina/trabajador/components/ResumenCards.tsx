/**
 * ResumenCards — estadísticas del período y selector de períodos.
 *
 * Jerarquía de información:
 *   1. Extra acumulado en pesos   (impacto positivo al bolsillo)
 *   2. Días registrados           (completitud)
 *   3. Panel expandible: horas extra por semana vs límite legal (Ley 2101)
 *   4. Desglose de horas con recargo nocturno/extra/festivo
 *   5. Selector de período
 */

import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatCOP } from '@/lib/formatters';
import {
  fmtPeriodo,
  getJornadaLegalSemanal,
  type ResumenPeriodoNomina,
  type ResumenSemana,
} from '../nominaTrabajadorUtils';
import type { PeriodoNomina } from '@api-client';

interface Props {
  resumen:              ResumenPeriodoNomina;
  periodos:             PeriodoNomina[];
  periodoActivoId:      number | undefined;
  onSeleccionarPeriodo: (id: number) => void;
  valorHora?:           number;
}

export function ResumenCards({
  resumen,
  periodos,
  periodoActivoId,
  onSeleccionarPeriodo,
  valorHora = 0,
}: Props) {
  const [expanded, setExpanded] = useState(false);

  const tieneExtras    = resumen.horasExtraDiurnas > 0 || resumen.horasExtraNocturnas > 0 ||
                         resumen.horasNocturnas > 0    || resumen.horasFestivo > 0;
  const semanasConExtra = resumen.semanas.filter((s) => s.horasExtra > 0);
  const tieneNovedades  = tieneExtras || semanasConExtra.length > 0;

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
          className="bg-card border border-border rounded-2xl px-4 py-3"
        >
          {/* Header del panel */}
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-2">
              {tieneExtras && <View className="w-2 h-2 rounded-full bg-success" />}
              <Text className="text-sm font-semibold text-foreground">
                Novedades del período
              </Text>
            </View>
            <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color="#64748B" />
          </View>

          {/* Resumen comprimido */}
          {!expanded && (
            <View className="flex-row gap-4 mt-2">
              {semanasConExtra.length > 0 && (
                <Text className="text-xs text-success">
                  ↑ {semanasConExtra.reduce((s, w) => s + w.horasExtra, 0).toFixed(1)}h extra
                </Text>
              )}
              {resumen.horasNocturnas > 0 && (
                <Text className="text-xs text-info">
                  🌙 {resumen.horasNocturnas.toFixed(1)}h nocturnas
                </Text>
              )}
              {resumen.horasFestivo > 0 && (
                <Text className="text-xs text-danger">
                  📅 {resumen.horasFestivo.toFixed(1)}h festivo
                </Text>
              )}
            </View>
          )}

          {/* Detalle expandido */}
          {expanded && (
            <View className="mt-3 gap-3">
              {/* Desglose semanal */}
              {resumen.semanas.length > 0 && (
                <View className="gap-1.5">
                  <Text className="text-xs font-semibold text-foreground">
                    Horas por semana
                  </Text>
                  {resumen.semanas.map((s) => (
                    <SemanaRow key={s.inicioSemana} semana={s} valorHora={valorHora} />
                  ))}
                  <Text className="text-[10px] text-muted-foreground mt-0.5">
                    Límite según Ley 2101 para {new Date().getFullYear()}: {getJornadaLegalSemanal(new Date().getFullYear())}h/semana.
                    Las horas extra solo se generan al superar este límite.
                  </Text>
                </View>
              )}

              {/* Horas con recargo por tipo */}
              {tieneExtras && (
                <View className="bg-primary-50 rounded-xl px-3 py-3 gap-1.5">
                  <Text className="text-xs font-semibold text-primary-600">
                    Horas con recargo acumuladas
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

// ── Primitivos locales ─────────────────────────────────────────────────────

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

const SHORT_MONTHS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

function fmtLunes(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return `${d.getDate()} ${SHORT_MONTHS[d.getMonth()]}`;
}

function SemanaRow({ semana, valorHora }: { semana: ResumenSemana; valorHora: number }) {
  const excede = semana.horasExtra > 0;
  const extra$ = excede ? Math.round(semana.horasExtra * 1.25 * valorHora) : 0;

  return (
    <View className="flex-row items-center justify-between py-1 border-b border-border last:border-0">
      <Text className="text-xs text-muted-foreground">
        Sem. {fmtLunes(semana.inicioSemana)}
      </Text>
      <View className="flex-row items-center gap-2">
        <Text className={`text-xs font-medium ${excede ? 'text-success' : 'text-foreground'}`}>
          {semana.horasTotales.toFixed(1)}h / {semana.limiteHoras}h
        </Text>
        {excede && (
          <Text className="text-xs font-semibold text-success">
            +{semana.horasExtra.toFixed(1)}h
            {extra$ > 0 ? ` ≈ +${formatCOP(extra$)}` : ''}
          </Text>
        )}
      </View>
    </View>
  );
}
