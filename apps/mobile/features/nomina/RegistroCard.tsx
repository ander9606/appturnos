/**
 * RegistroCard — fila de un registro diario de nómina.
 *
 * Jerarquía visual:
 *   • Día ordinario (8 h sin extras): sobrio, solo horas totales
 *   • Día con extras: chip colorido con tipo y horas
 *   • Día festivo: date pill rojo
 *   • Día corto (< 8 h - 30 min): badge de advertencia
 *   • Día especial (tipo_dia != 'ordinario'): badge amber
 *
 * Recibe valorHora para calcular el extra en pesos (opcional).
 */

import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import type { RegistroDiario } from '@api-client';
import {
  analizarDia,
  fmtHora,
  fmtFechaCorta,
  TIPO_DIA_LABEL,
} from './trabajador/nominaTrabajadorUtils';
import { formatCOP } from '@/lib/formatters';

const SHORT_DAYS = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];

interface RegistroCardProps {
  registro:   RegistroDiario;
  valorHora?: number;
}

export function RegistroCard({ registro, valorHora = 0 }: RegistroCardProps) {
  const [expanded, setExpanded] = useState(false);

  const analisis    = analizarDia(registro, valorHora);
  const tipoDiaLabel = TIPO_DIA_LABEL[registro.tipo_dia] ?? null;
  const canExpand   = analisis.tieneExtras || tipoDiaLabel !== null ||
                      registro.novedad     || analisis.esDiaCorto;

  const d = new Date(`${registro.fecha}T00:00:00`);

  return (
    <TouchableOpacity
      onPress={() => canExpand && setExpanded((v) => !v)}
      activeOpacity={canExpand ? 0.8 : 1}
      className="bg-card rounded-2xl overflow-hidden"
      style={{ elevation: 1, shadowColor:'#000', shadowOpacity:0.05, shadowRadius:6, shadowOffset:{width:0,height:2} }}
      accessibilityRole="button"
      accessibilityLabel={`Registro ${fmtFechaCorta(registro.fecha)}`}
    >
      {/* ── Fila principal ──────────────────────────────────── */}
      <View className="flex-row items-center px-4 py-3 gap-3">

        {/* Date pill */}
        <View className={`w-12 items-center py-2 rounded-xl ${analisis.esFestivo ? 'bg-danger-light' : 'bg-muted'}`}>
          <Text className={`text-[10px] font-medium ${analisis.esFestivo ? 'text-danger' : 'text-muted-foreground'}`}>
            {SHORT_DAYS[d.getDay()]}
          </Text>
          <Text className={`text-base font-bold ${analisis.esFestivo ? 'text-danger' : 'text-foreground'}`}>
            {d.getDate()}
          </Text>
        </View>

        {/* Horas + chips inline */}
        <View className="flex-1 gap-0.5">
          <Text className="text-sm font-medium text-foreground">
            {fmtHora(registro.hora_entrada)} → {fmtHora(registro.hora_salida)}
          </Text>

          {/* Chips de tipo: solo si no es un día 100 % ordinario */}
          {!analisis.esOrdinario && (
            <View className="flex-row gap-2 flex-wrap mt-0.5">
              {tipoDiaLabel && (
                <View className="bg-warning-light px-2 py-0.5 rounded-full">
                  <Text className="text-[10px] font-medium text-amber-700">{tipoDiaLabel}</Text>
                </View>
              )}
              {analisis.esDiaCorto && !tipoDiaLabel && (
                <View className="bg-warning-light px-2 py-0.5 rounded-full">
                  <Text className="text-[10px] font-medium text-amber-700">Jornada incompleta</Text>
                </View>
              )}
              {analisis.esFestivo && (
                <View className="bg-danger-light px-2 py-0.5 rounded-full">
                  <Text className="text-[10px] font-medium text-danger">Festivo</Text>
                </View>
              )}
              {Number(registro.horas_extra_diurnas) > 0 && (
                <View className="bg-primary-50 px-2 py-0.5 rounded-full">
                  <Text className="text-[10px] font-medium text-primary-600">
                    +{Number(registro.horas_extra_diurnas).toFixed(1)}h ext.d
                  </Text>
                </View>
              )}
              {Number(registro.horas_extra_nocturnas) > 0 && (
                <View className="bg-primary-50 px-2 py-0.5 rounded-full">
                  <Text className="text-[10px] font-medium text-primary-600">
                    +{Number(registro.horas_extra_nocturnas).toFixed(1)}h ext.n
                  </Text>
                </View>
              )}
              {Number(registro.horas_nocturnas) > 0 && (
                <View className="bg-blue-50 px-2 py-0.5 rounded-full">
                  <Text className="text-[10px] font-medium text-info">
                    {Number(registro.horas_nocturnas).toFixed(1)}h noc.
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>

        {/* Horas totales + extra en pesos + indicador expand */}
        <View className="items-end gap-1">
          <Text className="text-base font-bold text-foreground">
            {analisis.totalHoras.toFixed(1)}h
          </Text>
          {analisis.valorExtraCOP > 0 && (
            <Text className="text-xs font-semibold text-success">
              +{formatCOP(analisis.valorExtraCOP)}
            </Text>
          )}
          {canExpand && (
            <Text className="text-xs text-muted-foreground">{expanded ? '▲' : '▼'}</Text>
          )}
        </View>
      </View>

      {/* ── Panel expandido ─────────────────────────────────── */}
      {expanded && (
        <View className="px-4 pb-3 border-t border-border gap-2 pt-2">
          {/* Desglose detallado de horas */}
          {analisis.tieneExtras && (
            <View className="flex-row flex-wrap gap-x-4 gap-y-1">
              {Number(registro.horas_ordinarias) > 0 && (
                <Text className="text-xs text-muted-foreground">
                  {Number(registro.horas_ordinarias).toFixed(1)}h ordinarias
                </Text>
              )}
              {Number(registro.horas_nocturnas) > 0 && (
                <Text className="text-xs text-info">
                  {Number(registro.horas_nocturnas).toFixed(1)}h noct.
                </Text>
              )}
              {Number(registro.horas_extra_diurnas) > 0 && (
                <Text className="text-xs text-primary-500 font-medium">
                  +{Number(registro.horas_extra_diurnas).toFixed(1)}h ext.diurna
                </Text>
              )}
              {Number(registro.horas_extra_nocturnas) > 0 && (
                <Text className="text-xs text-primary-600 font-medium">
                  +{Number(registro.horas_extra_nocturnas).toFixed(1)}h ext.noct.
                </Text>
              )}
              {Number(registro.horas_festivo) > 0 && (
                <Text className="text-xs text-danger font-medium">
                  {Number(registro.horas_festivo).toFixed(1)}h festivo
                </Text>
              )}
            </View>
          )}

          {/* Novedad */}
          {registro.novedad && (
            <View>
              <Text className="text-xs text-muted-foreground">Novedad</Text>
              <Text className="text-sm text-foreground mt-0.5">{registro.novedad}</Text>
            </View>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
}
