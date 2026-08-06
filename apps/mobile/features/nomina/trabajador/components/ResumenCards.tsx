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
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatCOP } from '@/lib/formatters';
import { HOUR_TYPE_COLORS } from '@/lib/designTokens';
import { Badge } from '@/components/ui/Badge';
import { useAceptarDescuento, useRechazarDescuento } from '../../descuentos/useDescuentos';
import {
  fmtPeriodo,
  getJornadaLegalSemanal,
  type ResumenPeriodoNomina,
  type ResumenSemana,
} from '../nominaTrabajadorUtils';
import type { PeriodoNomina, LiquidacionLinea, TipoContrato, DescuentoNomina, TipoDescuento } from '@api-client';

const TIPO_DESCUENTO_LABELS: Record<TipoDescuento, string> = {
  prestamo: 'Préstamo',
  inasistencia: 'Inasistencia',
  dano_equipo: 'Daño a equipo',
  anticipo: 'Anticipo',
  otro: 'Otro',
};

interface Props {
  resumen:              ResumenPeriodoNomina;
  periodos:             PeriodoNomina[];
  periodoActivoId:      number | undefined;
  onSeleccionarPeriodo: (id: number) => void;
  valorHora?:           number;
  /** Liquidación real del período — para el detalle de pago opcional (bruto/descuentos). */
  miLiquidacion?: LiquidacionLinea;
  tipoContrato?:  TipoContrato;
  /** Descuentos manuales propios del período (pendientes, aceptados, rechazados). */
  misDescuentos?: DescuentoNomina[];
}

export function ResumenCards({
  resumen,
  periodos,
  periodoActivoId,
  onSeleccionarPeriodo,
  valorHora = 0,
  miLiquidacion,
  tipoContrato,
  misDescuentos = [],
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const pendientes = misDescuentos.filter((d) => d.estado === 'pendiente');
  const rechazados = misDescuentos.filter((d) => d.estado === 'rechazado');
  const [expandedPago, setExpandedPago] = useState(pendientes.length > 0);
  const [respondiendoId, setRespondiendoId] = useState<number | null>(null);
  const aceptarDescuento = useAceptarDescuento();
  const rechazarDescuento = useRechazarDescuento();

  const tieneDeduccionLegal = tipoContrato === 'laboral' && miLiquidacion && miLiquidacion.neto !== miLiquidacion.total;
  const tieneDescuentos = tieneDeduccionLegal || pendientes.length > 0 || rechazados.length > 0;

  const handleResponder = async (id: number, aceptar: boolean) => {
    if (!aceptar) {
      const ok = await new Promise<boolean>((resolve) =>
        Alert.alert('Rechazar descuento', 'Tu empleador verá que lo rechazaste. ¿Confirmas?', [
          { text: 'Cancelar', style: 'cancel', onPress: () => resolve(false) },
          { text: 'Rechazar', style: 'destructive', onPress: () => resolve(true) },
        ])
      );
      if (!ok) return;
    }
    setRespondiendoId(id);
    try {
      await (aceptar ? aceptarDescuento : rechazarDescuento).mutateAsync(id);
    } catch {
      Alert.alert('Error', 'No se pudo registrar tu respuesta. Intenta de nuevo.');
    } finally {
      setRespondiendoId(null);
    }
  };

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

      {/* ── Detalle de pago — colapsado, solo si hay algo que explicar ── */}
      {tieneDescuentos && (
        <TouchableOpacity
          onPress={() => setExpandedPago((v) => !v)}
          activeOpacity={0.8}
          className="bg-card border border-border rounded-2xl px-4 py-3"
        >
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-2">
              {pendientes.length > 0 && <View className="w-2 h-2 rounded-full bg-warning" />}
              <Text className="text-sm font-semibold text-foreground">Detalle de pago</Text>
            </View>
            <Ionicons name={expandedPago ? 'chevron-up' : 'chevron-down'} size={16} color="#64748B" />
          </View>

          {!expandedPago && pendientes.length > 0 && (
            <Text className="text-xs text-warning mt-1.5">
              {pendientes.length} descuento{pendientes.length > 1 ? 's' : ''} por aceptar
            </Text>
          )}

          {expandedPago && (
            <View className="gap-3 mt-3">
              {miLiquidacion && tieneDeduccionLegal && (
                <View className="gap-1.5">
                  <View className="flex-row items-center justify-between">
                    <Text className="text-xs text-muted-foreground">Bruto</Text>
                    <Text className="text-xs font-medium text-foreground">{formatCOP(miLiquidacion.total)}</Text>
                  </View>
                  <View className="flex-row items-center justify-between">
                    <Text className="text-xs text-muted-foreground">Salud (4%)</Text>
                    <Text className="text-xs font-medium text-danger">-{formatCOP(miLiquidacion.descuento_salud)}</Text>
                  </View>
                  <View className="flex-row items-center justify-between">
                    <Text className="text-xs text-muted-foreground">Pensión</Text>
                    <Text className="text-xs font-medium text-danger">-{formatCOP(miLiquidacion.descuento_pension)}</Text>
                  </View>
                  {miLiquidacion.otros_descuentos.map((d) => (
                    <View key={d.id} className="flex-row items-center justify-between">
                      <Text className="text-xs text-muted-foreground">{TIPO_DESCUENTO_LABELS[d.tipo]} · {d.motivo}</Text>
                      <Text className="text-xs font-medium text-danger">-{formatCOP(d.monto)}</Text>
                    </View>
                  ))}
                  <View className="flex-row items-center justify-between pt-1.5 mt-0.5 border-t border-border">
                    <Text className="text-xs font-semibold text-foreground">Neto</Text>
                    <Text className="text-xs font-bold text-success">{formatCOP(miLiquidacion.neto)}</Text>
                  </View>
                </View>
              )}

              {pendientes.length > 0 && (
                <View className="gap-2 pt-1 border-t border-border">
                  <Text className="text-xs font-semibold text-foreground mt-2">Por tu aceptación</Text>
                  {pendientes.map((d) => (
                    <View key={d.id} className="bg-warning/10 rounded-xl p-3 gap-2">
                      <View className="flex-row items-center justify-between">
                        <Text className="text-xs font-semibold text-foreground flex-1">
                          {TIPO_DESCUENTO_LABELS[d.tipo]} · {d.motivo}
                        </Text>
                        <Text className="text-xs font-bold text-danger">-{formatCOP(d.monto)}</Text>
                      </View>
                      <View className="flex-row gap-2">
                        <TouchableOpacity
                          onPress={() => handleResponder(d.id, false)}
                          disabled={respondiendoId === d.id}
                          className="flex-1 h-8 rounded-lg border border-border items-center justify-center"
                        >
                          <Text className="text-xs font-semibold text-muted-foreground">Rechazar</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => handleResponder(d.id, true)}
                          disabled={respondiendoId === d.id}
                          className="flex-1 h-8 rounded-lg bg-primary-500 items-center justify-center active:opacity-80"
                        >
                          {respondiendoId === d.id
                            ? <ActivityIndicator size="small" color="#fff" />
                            : <Text className="text-xs font-semibold text-white">Aceptar</Text>}
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
                </View>
              )}

              {rechazados.length > 0 && (
                <View className="gap-1.5 pt-1 border-t border-border">
                  {rechazados.map((d) => (
                    <View key={d.id} className="flex-row items-center gap-2">
                      <Badge label="Rechazado" variant="default" size="sm" />
                      <Text className="text-xs text-muted-foreground flex-1">
                        {TIPO_DESCUENTO_LABELS[d.tipo]} · {d.motivo}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}
        </TouchableOpacity>
      )}

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
                    Jornada máxima legal en {new Date().getFullYear()}: {getJornadaLegalSemanal(new Date().getFullYear())}h/semana.
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
                      <HoraChip label="Extra diurna" horas={resumen.horasExtraDiurnas} color={HOUR_TYPE_COLORS.extraDiurna} />
                    )}
                    {resumen.horasExtraNocturnas > 0 && (
                      <HoraChip label="Extra noct." horas={resumen.horasExtraNocturnas} color={HOUR_TYPE_COLORS.extraNocturna} />
                    )}
                    {resumen.horasNocturnas > 0 && (
                      <HoraChip label="Nocturnas" horas={resumen.horasNocturnas} color={HOUR_TYPE_COLORS.nocturna} />
                    )}
                    {resumen.horasFestivo > 0 && (
                      <HoraChip label="Festivo" horas={resumen.horasFestivo} color={HOUR_TYPE_COLORS.festivo} />
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

function HoraChip({ label, horas, color }: { label: string; horas: number; color: string }) {
  return (
    <View className="gap-0.5">
      <Text className="text-sm font-bold" style={{ color }}>{horas.toFixed(1)}h</Text>
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
  const pct = Math.min(100, (semana.horasTotales / semana.limiteHoras) * 100);

  return (
    <View className="py-1.5 border-b border-border last:border-0 gap-1.5">
      <View className="flex-row items-center justify-between">
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
      {/* excede = trabajó más del límite legal = generó extra — es buena noticia
          para el trabajador, por eso va en success y no en un color de alerta. */}
      <View className="h-1.5 rounded-full bg-muted overflow-hidden">
        <View
          className="h-full rounded-full"
          style={{ width: `${pct}%`, backgroundColor: excede ? '#059669' : '#CBD5E1' }}
        />
      </View>
    </View>
  );
}
