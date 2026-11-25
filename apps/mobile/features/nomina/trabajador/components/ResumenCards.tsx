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

import { Text } from '@/components/ui/Text';
import React, { useEffect, useState } from 'react';
import { View, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatCOP } from '@/lib/formatters';
import { COLORS, HOUR_TYPE_COLORS } from '@/lib/designTokens';
import { Badge } from '@/components/ui/Badge';
import { MarcaPeriodoAnterior } from './MarcaPeriodoAnterior';
import { FranjaSemana } from './FranjaSemana';
import { PagoDesglose } from '../../PagoDesglose';
import {
  fmtPeriodo,
  estimarExtraSemanaCOP,
  tramosSemana,
  fmtRangoDias,
  fmtFechaCorta,
  type ResumenPeriodoNomina,
  type ResumenSemana,
} from '../nominaTrabajadorUtils';
import type { PeriodoNomina, LiquidacionLinea, TipoContrato, DescuentoNomina, TipoDescuento } from '@api-client';

export const TIPO_DESCUENTO_LABELS: Record<TipoDescuento, string> = {
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
  /** Abre la ventana emergente donde se aceptan / rechazan los descuentos pendientes. */
  onRevisarDescuentos?: () => void;
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
  onRevisarDescuentos,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const periodoActivo = periodos.find((p) => p.id === periodoActivoId);
  const pendientes = misDescuentos.filter((d) => d.estado === 'pendiente');
  const rechazados = misDescuentos.filter((d) => d.estado === 'rechazado');
  const [expandedPago, setExpandedPago] = useState(pendientes.length > 0);
  // El estado inicial se calcula antes de que lleguen los descuentos: ábrelo cuando aparezcan pendientes.
  useEffect(() => {
    if (pendientes.length > 0) setExpandedPago(true);
  }, [pendientes.length]);

  const tieneDescuentos = pendientes.length > 0 || rechazados.length > 0;

  // Misma fuente de verdad que ve el gestor — reemplaza el estimado del cliente
  // (resumen.valorExtraCOP, fórmula distinta) apenas llega la liquidación real.
  const pagoExtraPeriodo = miLiquidacion
    ? Number(miLiquidacion.pago_nocturno) + Number(miLiquidacion.pago_extra_diurno) +
      Number(miLiquidacion.pago_extra_nocturno) + Number(miLiquidacion.pago_festivo)
    : resumen.valorExtraCOP;

  const tieneExtras    = resumen.horasExtraDiurnas > 0 || resumen.horasExtraNocturnas > 0 ||
                         resumen.horasNocturnas > 0    || resumen.horasFestivo > 0;
  const semanasConExtra = resumen.semanas.filter((s) => s.horasExtra > 0);
  const tieneNovedades  = tieneExtras || semanasConExtra.length > 0;
  // El desglose por semana vive en la lista de registros; aquí solo hay detalle para quien aún no tiene liquidación.
  const hayDetalle      = !miLiquidacion && tieneExtras;

  return (
    <View className="gap-3">
      {/* ── Fila principal: extra $ · días ─────────────────── */}
      <View className="flex-row gap-2">
        <StatCard
          label="Extra período"
          value={pagoExtraPeriodo > 0 ? `+${formatCOP(pagoExtraPeriodo)}` : '$0'}
          valueClass={pagoExtraPeriodo > 0 ? 'text-success' : 'text-muted-foreground'}
        />
        <StatCard
          label="Días regist."
          value={String(resumen.diasRegistrados)}
          valueClass="text-foreground"
        />
      </View>

      {/* ── Tu pago del período: de dónde sale, siempre visible cuando hay liquidación ── */}
      {miLiquidacion && (
        <View className="bg-card border border-border rounded-2xl px-4 py-4 gap-3">
          <View className="flex-row items-center justify-between">
            <Text className="text-sm font-semibold text-foreground">Tu pago del período</Text>
            {periodoActivo?.estado === 'abierto' && <Badge label="Estimado" variant="warning" size="sm" />}
          </View>
          <PagoDesglose linea={miLiquidacion} />
        </View>
      )}

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
              <Text className="text-sm font-semibold text-foreground">Descuentos</Text>
            </View>
            <Ionicons name={expandedPago ? 'chevron-up' : 'chevron-down'} size={16} color={COLORS.mutedForeground} />
          </View>

          {!expandedPago && pendientes.length > 0 && (
            <Text className="text-xs text-warning mt-1.5">
              {pendientes.length} descuento{pendientes.length > 1 ? 's' : ''} por aceptar
            </Text>
          )}

          {expandedPago && (
            <View className="gap-3 mt-3">
              {pendientes.length > 0 && (
                <View className="gap-2">
                  <Text className="text-xs font-semibold text-foreground">Por tu aceptación</Text>
                  {pendientes.map((d) => (
                    <View key={d.id} className="flex-row items-center justify-between">
                      <Text className="text-xs text-muted-foreground flex-1">
                        {TIPO_DESCUENTO_LABELS[d.tipo]} · {d.motivo}
                      </Text>
                      <Text className="text-xs font-bold text-danger">-{formatCOP(d.monto)}</Text>
                    </View>
                  ))}
                  <TouchableOpacity
                    onPress={onRevisarDescuentos}
                    className="h-9 rounded-lg bg-primary-500 items-center justify-center active:opacity-80"
                  >
                    <Text className="text-xs font-semibold text-white">Revisar y responder</Text>
                  </TouchableOpacity>
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
          disabled={!hayDetalle}
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
            {hayDetalle && <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color={COLORS.mutedForeground} />}
          </View>

          {/* Resumen comprimido */}
          {(!expanded || !hayDetalle) && (
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
          {expanded && hayDetalle && (
            <View className="mt-3 gap-3">
              {!miLiquidacion && tieneExtras && (
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
      style={{ elevation: 1, shadowColor: COLORS.shadow, shadowOpacity: 0.04, shadowRadius: 6 }}
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

/**
 * Una semana (lun–dom) del período. Con `periodo` muestra el rango completo y, si la semana está
 * partida por el corte del período (siempre pasa en la primera y última semana de una quincena
 * o un mes), separa qué días/horas son de este período, cuáles del anterior y cuáles del siguiente.
 */
export function SemanaRow({ semana, valorHora, periodo }: {
  semana: ResumenSemana;
  valorHora: number;
  periodo?: { fecha_inicio: string; fecha_fin: string };
}) {
  const excede = semana.horasExtra > 0;
  const extra$ = estimarExtraSemanaCOP(semana, valorHora);
  const pct = Math.min(100, (semana.horasTotales / semana.limiteHoras) * 100);
  const t = periodo ? tramosSemana(semana.inicioSemana, periodo.fecha_inicio, periodo.fecha_fin) : null;
  const partida = !!t && (t.anterior !== null || t.siguiente !== null);
  const horasPrevias = semana.horasPrevias ?? 0;
  const horasComp = semana.horasCompensatorio ?? 0;
  const titulo = t
    ? fmtRangoDias(semana.inicioSemana, (t.siguiente ?? t.enPeriodo).hasta)
    : `Sem. ${fmtLunes(semana.inicioSemana)}`;

  return (
    <View className="py-1.5 border-b border-border last:border-0 gap-1.5">
      <View className="flex-row items-center justify-between">
        <Text className="text-xs font-medium text-foreground">{titulo}</Text>
        <View className="flex-row items-center gap-2">
          <Text className={`text-xs font-medium ${excede ? 'text-success' : 'text-foreground'}`}>
            {partida ? 'Semana: ' : ''}{semana.horasTotales.toFixed(1)}h / {semana.limiteHoras}h
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
      <View className="relative h-1.5 rounded-full bg-muted overflow-hidden">
        <View
          className="h-full rounded-full"
          style={{ width: `${pct}%`, backgroundColor: excede ? COLORS.success : COLORS.borderStrong }}
        />
        <MarcaPeriodoAnterior horas={semana.horasPrevias ?? 0} limite={semana.limiteHoras} color={COLORS.slate700} />
      </View>
      {!!semana.horasFestivo && (
        <Text className="text-[10px] text-danger">
          +{semana.horasFestivo.toFixed(1)}h festivo (recargo, no cuenta para las {semana.limiteHoras}h)
        </Text>
      )}
      {periodo && (partida || horasComp > 0) ? (
        <FranjaSemana
          lunes={semana.inicioSemana}
          periodo={periodo}
          horasAnterior={horasPrevias}
          horasEste={semana.horasTotales - horasPrevias - horasComp}
          fechasCompensatorio={semana.fechasCompensatorio}
        />
      ) : null}
      {horasPrevias > 0 && (
        <Text className="text-[10px] text-muted-foreground">La raya de la barra marca las horas del período anterior.</Text>
      )}
      {horasComp > 0 && (
        <View className="flex-row items-center gap-1">
          <Ionicons name="bed-outline" size={12} color={COLORS.info} />
          <Text className="text-[10px] text-info flex-1">
            +{horasComp.toFixed(1)}h por el compensatorio del {(semana.origenesCompensatorio ?? []).map(fmtFechaCorta).join(' y ')}
          </Text>
        </View>
      )}
    </View>
  );
}
