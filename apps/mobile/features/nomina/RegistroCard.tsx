/**
 * RegistroCard — fila de un registro diario de nómina.
 *
 * Jerarquía visual (Opción B):
 *   • Día ordinario (8 h sin extras): sobrio — solo entrada/salida + "Jornada completa"
 *   • Día con extras: chips de horas extra + monto adicional en verde destacado
 *   • Día festivo: date pill rojo
 *   • Día corto (< 8 h - 30 min): badge de advertencia
 *   • Día especial (descanso, vacación, etc.): badge amber, sin horario
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

  const analisis     = analizarDia(registro, valorHora);
  const tipoDiaLabel = TIPO_DIA_LABEL[registro.tipo_dia] ?? null;
  const esEspecial   = tipoDiaLabel !== null;
  const sinSalida    = Boolean(registro.hora_entrada) && !registro.hora_salida;
  const canExpand    = analisis.tieneExtras || registro.novedad || sinSalida;

  const d = new Date(`${registro.fecha}T00:00:00`);

  // ── Etiqueta de estado del día ─────────────────────────────────────────
  function EstadoLabel() {
    if (esEspecial) {
      return (
        <View className="bg-warning-light px-2 py-0.5 rounded-full self-start">
          <Text className="text-[10px] font-medium text-amber-700">{tipoDiaLabel}</Text>
        </View>
      );
    }
    if (!registro.hora_entrada) return null;
    if (!registro.hora_salida) {
      return (
        <View className="bg-warning-light px-2 py-0.5 rounded-full self-start">
          <Text className="text-[10px] font-medium text-amber-700">Sin salida</Text>
        </View>
      );
    }
    if (!analisis.tieneExtras && !analisis.esFestivo) {
      return <Text className="text-xs text-muted-foreground">Jornada completa</Text>;
    }
    return null;
  }

  // ── Chips de horas extra (solo las que generan ingreso adicional) ───────
  function ExtraChips() {
    if (!analisis.tieneExtras && !analisis.esFestivo) return null;
    return (
      <View className="flex-row gap-1.5 flex-wrap mt-0.5">
        {Number(registro.horas_extra_diurnas) > 0 && (
          <View className="bg-primary-50 px-2 py-0.5 rounded-full">
            <Text className="text-[10px] font-semibold text-primary-600">
              +{Number(registro.horas_extra_diurnas).toFixed(1)}h ext. diurna
            </Text>
          </View>
        )}
        {Number(registro.horas_extra_nocturnas) > 0 && (
          <View className="bg-primary-50 px-2 py-0.5 rounded-full">
            <Text className="text-[10px] font-semibold text-primary-600">
              +{Number(registro.horas_extra_nocturnas).toFixed(1)}h ext. noct.
            </Text>
          </View>
        )}
        {Number(registro.horas_nocturnas) > 0 && (
          <View className="bg-blue-50 px-2 py-0.5 rounded-full">
            <Text className="text-[10px] font-semibold text-info">
              {Number(registro.horas_nocturnas).toFixed(1)}h noct.
            </Text>
          </View>
        )}
        {analisis.esFestivo && (
          <View className="bg-danger-light px-2 py-0.5 rounded-full">
            <Text className="text-[10px] font-semibold text-danger">Festivo</Text>
          </View>
        )}
      </View>
    );
  }

  return (
    <TouchableOpacity
      onPress={() => canExpand && setExpanded((v) => !v)}
      activeOpacity={canExpand ? 0.8 : 1}
      className="bg-card rounded-2xl overflow-hidden"
      style={{ elevation: 1, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } }}
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

        {/* Centro: horario + estado/extras */}
        <View className="flex-1 gap-0.5">
          {esEspecial ? (
            // Días especiales no tienen horario que mostrar
            <EstadoLabel />
          ) : (
            <>
              <Text className="text-sm font-medium text-foreground">
                {registro.hora_entrada
                  ? `${fmtHora(registro.hora_entrada)} → ${fmtHora(registro.hora_salida)}`
                  : 'Sin registro'}
              </Text>
              <EstadoLabel />
              <ExtraChips />
            </>
          )}
        </View>

        {/* Derecha: solo el monto extra si lo hay, nada si es ordinario */}
        <View className="items-end gap-1 min-w-[64px]">
          {analisis.valorExtraCOP > 0 ? (
            <>
              <Text className="text-xs text-muted-foreground">adicional</Text>
              <Text className="text-sm font-bold text-success">
                +{formatCOP(analisis.valorExtraCOP)}
              </Text>
            </>
          ) : canExpand ? (
            <Text className="text-xs text-muted-foreground">{expanded ? '▲' : '▼'}</Text>
          ) : null}
          {analisis.valorExtraCOP > 0 && canExpand && (
            <Text className="text-xs text-muted-foreground">{expanded ? '▲' : '▼'}</Text>
          )}
        </View>
      </View>

      {/* ── Panel expandido: desglose detallado ─────────────── */}
      {expanded && (
        <View className="px-4 pb-3 border-t border-border gap-2 pt-2">
          {sinSalida && (
            <Text className="text-xs text-amber-700">
              Este registro quedó sin hora de salida. No puedes corregirlo tú mismo — pídele a tu
              jefe de nómina o administrador que lo edite desde el panel de gestión.
            </Text>
          )}
          {analisis.tieneExtras && (
            <View className="flex-row flex-wrap gap-x-4 gap-y-1">
              {Number(registro.horas_ordinarias) > 0 && (
                <Text className="text-xs text-muted-foreground">
                  {Number(registro.horas_ordinarias).toFixed(1)}h ordinarias (cubiertas por salario)
                </Text>
              )}
              {Number(registro.horas_nocturnas) > 0 && (
                <Text className="text-xs text-info">
                  {Number(registro.horas_nocturnas).toFixed(1)}h noct. (+35 %)
                </Text>
              )}
              {Number(registro.horas_extra_diurnas) > 0 && (
                <Text className="text-xs text-primary-500 font-medium">
                  +{Number(registro.horas_extra_diurnas).toFixed(1)}h ext. diurna (+125 %)
                </Text>
              )}
              {Number(registro.horas_extra_nocturnas) > 0 && (
                <Text className="text-xs text-primary-600 font-medium">
                  +{Number(registro.horas_extra_nocturnas).toFixed(1)}h ext. noct. (+175 %)
                </Text>
              )}
              {Number(registro.horas_festivo) > 0 && (
                <Text className="text-xs text-danger font-medium">
                  {Number(registro.horas_festivo).toFixed(1)}h festivo (+75 %)
                </Text>
              )}
            </View>
          )}
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
