/**
 * LiquidacionRow — fila de trabajador en la vista de liquidación (jefe/admin)
 */
import { Text, TextInput } from '@/components/ui/Text';
import { showAlert } from '@/lib/alertDialog';
import { Spinner } from '@/components/ui/Spinner';
import React, { useState } from 'react';
import { View, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { LiquidacionLinea, DescansoCompensatorio, DescuentoNomina, TipoDescuento } from '@api-client';
import { getInitials, formatCOP } from '@/lib/formatters';
import { COLORS, HOUR_TYPE_COLORS, avatarColorForId } from '@/lib/designTokens';
import { CompositionBar } from '@/components/ui/CompositionBar';
import { Badge } from '@/components/ui/Badge';
import { ChipsIconoNumero } from './ChipsIconoNumero';
import { useCrearDescuento } from './descuentos/useDescuentos';
import { PagoDesglose } from './PagoDesglose';

const TIPO_DESCUENTO_LABELS: Record<TipoDescuento, string> = {
  prestamo: 'Préstamo',
  inasistencia: 'Inasistencia',
  dano_equipo: 'Daño a equipo',
  anticipo: 'Anticipo',
  otro: 'Otro',
};
const TIPO_DESCUENTO_OPTIONS = Object.keys(TIPO_DESCUENTO_LABELS) as TipoDescuento[];

interface LiquidacionRowProps {
  linea: LiquidacionLinea;
  compensatorios?: DescansoCompensatorio[];
  /** Descuentos pendientes o rechazados de este trabajador en el período (los aceptados van en linea.otros_descuentos). */
  descuentosPendientes?: DescuentoNomina[];
  periodoId?: number;
  fechaInicio?: string;
  fechaFin?: string;
  /** Horas en recargo/extra (extra diurna+nocturna+nocturna+festivo) — para el badge de outlier. */
  recargoHoras?: number;
  /** true si su proporción de recargo/extra está notablemente por encima del promedio del equipo. */
  outlier?: boolean;
}

export function LiquidacionRow({
  linea, compensatorios = [], descuentosPendientes = [], periodoId, fechaInicio, fechaFin, recargoHoras = 0, outlier = false,
}: LiquidacionRowProps) {
  const [expanded, setExpanded] = useState(false);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [tipo, setTipo] = useState<TipoDescuento>('prestamo');
  const [motivo, setMotivo] = useState('');
  const [monto, setMonto] = useState('');
  const crearDescuento = useCrearDescuento();
  const router = useRouter();

  const handleGuardarDescuento = async () => {
    const montoNum = Number(monto);
    if (!motivo.trim()) { showAlert('Falta el motivo', 'Escribe una razón breve para el descuento.', 'warning'); return; }
    if (!montoNum || montoNum <= 0) { showAlert('Monto inválido', 'El monto debe ser mayor a 0.', 'warning'); return; }
    if (!periodoId) return;
    try {
      await crearDescuento.mutateAsync({
        trabajador_id: linea.trabajador_id,
        periodo_id: periodoId,
        tipo,
        motivo: motivo.trim(),
        monto: montoNum,
      });
      setMotivo(''); setMonto(''); setTipo('prestamo'); setMostrarForm(false);
    } catch {
      showAlert('Error', 'No se pudo registrar el descuento.');
    }
  };

  const totalHoras =
    linea.horas_ordinarias + linea.horas_extra_diurnas +
    linea.horas_extra_nocturnas + linea.horas_nocturnas + linea.horas_festivo;

  const extrasTotal = linea.horas_extra_diurnas + linea.horas_extra_nocturnas;

  return (
    <TouchableOpacity
      onPress={() => setExpanded((v) => !v)}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityState={{ expanded }}
      accessibilityLabel={`${linea.nombre} ${linea.apellido}, neto ${formatCOP(linea.neto)}`}
      className="bg-card rounded-2xl overflow-hidden"
      style={{ elevation: 1, shadowColor:COLORS.shadow, shadowOpacity:0.05, shadowRadius:6 }}
    >
      {/* ── Main row ─────────────────────────────────────────── */}
      <View className="flex-row items-center px-4 py-4 gap-3">
        {/* Avatar */}
        <View
          className="w-10 h-10 rounded-full items-center justify-center"
          style={{ backgroundColor: avatarColorForId(linea.trabajador_id) }}
        >
          <Text className="text-sm font-bold text-white">
            {getInitials(linea.nombre, linea.apellido)}
          </Text>
        </View>

        {/* Name + days + badges */}
        <View className="flex-1 gap-0.5">
          <Text className="text-sm font-semibold text-foreground" numberOfLines={1}>
            {linea.nombre} {linea.apellido}
          </Text>
          <Text className="text-xs text-muted-foreground">
            {linea.dias_registrados} días · {totalHoras.toFixed(1)}h totales
          </Text>
          <ChipsIconoNumero
            items={[
              { cantidad: outlier ? recargoHoras : 0, texto: `${recargoHoras.toFixed(0)}h`, icono: 'trending-up-outline', color: COLORS.warning,
                etiqueta: `${recargoHoras.toFixed(0)} horas en recargos o extra, por encima del promedio del equipo` },
              { cantidad: extrasTotal, texto: `${extrasTotal.toFixed(1)}h`, icono: 'flash-outline', color: COLORS.primary,
                etiqueta: `${extrasTotal.toFixed(1)} horas extra` },
              { cantidad: compensatorios.length, icono: 'bed-outline', color: COLORS.info,
                etiqueta: `${compensatorios.length} compensatorios` },
            ]}
          />
        </View>

        {/* Neto a pagar (siempre el neto: así las filas suman la cabecera) + expandir */}
        <View className="items-end gap-0.5">
          <Text className="text-base font-bold text-success">{formatCOP(linea.neto)}</Text>
          {linea.neto !== linea.total && (
            <Text className="text-[10px] text-muted-foreground">bruto {formatCOP(linea.total)}</Text>
          )}
          <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={14} color={COLORS.mutedForeground} />
        </View>
      </View>

      {/* ── Composición en horas — solo con la fila plegada: al desplegar, la barra en pesos del desglose
          cuenta la misma historia y dos barras seguidas eran una redundancia. ── */}
      {!expanded && (
        <View className="px-4 pb-3 -mt-1">
          <CompositionBar
            height={6}
            segments={[
              { value: linea.horas_ordinarias,      color: HOUR_TYPE_COLORS.ordinarias },
              { value: linea.horas_extra_nocturnas, color: HOUR_TYPE_COLORS.extraNocturna },
              { value: linea.horas_extra_diurnas,   color: HOUR_TYPE_COLORS.extraDiurna },
              { value: linea.horas_nocturnas,       color: HOUR_TYPE_COLORS.nocturna },
              { value: linea.horas_festivo,         color: HOUR_TYPE_COLORS.festivo },
            ]}
          />
        </View>
      )}

      {/* ── Expanded: de dónde sale el pago ─────────────────── */}
      {expanded && (
        <View className="px-4 pb-4 border-t border-border">
          <View className="mt-3">
            <PagoDesglose linea={linea} />
          </View>
          {/* ── Descuentos manuales (préstamos, inasistencias, etc.) ─── */}
          <View className="mt-3 pt-3 border-t border-border gap-2">
            {descuentosPendientes.map((d) => (
              <View key={d.id} className="flex-row items-center gap-2">
                <Badge
                  label={d.estado === 'pendiente' ? 'Por aceptar' : 'Rechazado'}
                  variant={d.estado === 'pendiente' ? 'warning' : 'danger'}
                  size="sm"
                />
                <Text className="text-xs text-muted-foreground flex-1">
                  {TIPO_DESCUENTO_LABELS[d.tipo]} · {d.motivo}
                </Text>
                <Text className="text-xs font-medium text-muted-foreground">-${d.monto.toLocaleString('es-CO')}</Text>
              </View>
            ))}

            {mostrarForm ? (
              <View className="bg-muted/50 rounded-xl p-3 gap-2 mt-1">
                <View className="flex-row flex-wrap gap-1.5">
                  {TIPO_DESCUENTO_OPTIONS.map((opt) => (
                    <TouchableOpacity
                      key={opt}
                      onPress={() => setTipo(opt)}
                      className={`px-2.5 py-1 rounded-full border ${tipo === opt ? 'bg-primary-500 border-primary-500' : 'bg-card border-border'}`}
                    >
                      <Text className={`text-[11px] font-semibold ${tipo === opt ? 'text-white' : 'text-muted-foreground'}`}>
                        {TIPO_DESCUENTO_LABELS[opt]}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TextInput
                  value={motivo}
                  onChangeText={setMotivo}
                  placeholder="Motivo (ej. Préstamo del 12 de marzo)"
                  placeholderTextColor={COLORS.placeholder}
                  className="text-sm text-foreground border border-border rounded-lg px-3 py-2 bg-card"
                />
                <TextInput
                  value={monto}
                  onChangeText={setMonto}
                  placeholder="Monto (COP)"
                  placeholderTextColor={COLORS.placeholder}
                  keyboardType="numeric"
                  className="text-sm text-foreground border border-border rounded-lg px-3 py-2 bg-card"
                />
                <View className="flex-row gap-2 mt-1">
                  <TouchableOpacity
                    onPress={() => { setMostrarForm(false); setMotivo(''); setMonto(''); }}
                    className="flex-1 h-9 rounded-lg border border-border items-center justify-center"
                  >
                    <Text className="text-xs font-semibold text-muted-foreground">Cancelar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleGuardarDescuento}
                    disabled={crearDescuento.isPending}
                    className="flex-1 h-9 rounded-lg bg-primary-500 items-center justify-center active:opacity-80"
                  >
                    {crearDescuento.isPending
                      ? <Spinner size="small" color={COLORS.white} />
                      : <Text className="text-xs font-semibold text-white">Guardar</Text>}
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              periodoId && (
                <TouchableOpacity
                  onPress={() => setMostrarForm(true)}
                  className="flex-row items-center gap-1.5 mt-0.5"
                >
                  <Ionicons name="add-circle-outline" size={14} color={COLORS.integracion} />
                  <Text className="text-xs font-semibold text-primary">Agregar descuento</Text>
                </TouchableOpacity>
              )
            )}
          </View>

          <View className="flex-row items-center gap-2 mt-3 pt-3 border-t border-border">
            <Ionicons name="card-outline" size={14} color={COLORS.placeholder} />
            {linea.numero_cuenta ? (
              <Text className="text-xs text-foreground flex-1">
                <Text className="font-semibold">{linea.banco}</Text>
                {` · ${linea.tipo_cuenta === 'corriente' ? 'Corriente' : 'Ahorros'} · ${linea.numero_cuenta}`}
              </Text>
            ) : (
              <Text className="text-xs text-muted-foreground flex-1">Sin datos bancarios registrados</Text>
            )}
          </View>
          {periodoId && (
            <TouchableOpacity
              onPress={() => router.push(
                `/registros-periodo?periodoId=${periodoId}&trabajadorId=${linea.trabajador_id}${
                  fechaInicio && fechaFin ? `&fechaInicio=${fechaInicio}&fechaFin=${fechaFin}` : ''
                }`
              )}
              className="flex-row items-center gap-1 mt-3"
            >
              <Ionicons name="calendar-outline" size={13} color={COLORS.integracion} />
              <Text className="text-xs font-semibold text-primary">Ver registros del período</Text>
              <Ionicons name="chevron-forward" size={12} color={COLORS.integracion} />
            </TouchableOpacity>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
}
