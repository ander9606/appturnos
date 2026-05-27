/**
 * RegistroCard — una fila de registro diario de nómina
 *
 * Muestra: fecha · entrada→salida · desglose de horas · novedad
 */
import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import type { RegistroDiario } from '@api-client';

const SHORT_DAYS   = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
const SHORT_MONTHS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

function fmt(iso: string) {
  const d = new Date(`${iso}T00:00:00`);
  return `${SHORT_DAYS[d.getDay()]} ${d.getDate()} ${SHORT_MONTHS[d.getMonth()]}`;
}
function fmtTime(t: string | null) {
  return t ? t.slice(0, 5) : '—';
}
function h(n: number) {
  return n > 0 ? n.toFixed(1) : null;
}

interface RegistroCardProps {
  registro: RegistroDiario;
}

export function RegistroCard({ registro }: RegistroCardProps) {
  const [expanded, setExpanded] = useState(false);

  const ord  = Number(registro.horas_ordinarias);
  const exd  = Number(registro.horas_extra_diurnas);
  const exn  = Number(registro.horas_extra_nocturnas);
  const noc  = Number(registro.horas_nocturnas);
  const fest = Number(registro.horas_festivo);
  const total = ord + exd + exn + noc + fest;

  const hasExtras = exd > 0 || exn > 0 || noc > 0 || fest > 0;
  const isFestivo = registro.es_festivo === 1;

  return (
    <TouchableOpacity
      onPress={() => setExpanded((v) => !v)}
      activeOpacity={0.8}
      className="bg-card rounded-2xl overflow-hidden"
      style={{ elevation: 1, shadowColor:'#000', shadowOpacity:0.05, shadowRadius:6, shadowOffset:{width:0,height:2} }}
      accessibilityRole="button"
      accessibilityLabel={`Registro ${fmt(registro.fecha)}`}
    >
      {/* ── Main row ─────────────────────────────────────────── */}
      <View className="flex-row items-center px-4 py-3 gap-3">
        {/* Date pill */}
        <View className={`w-12 items-center py-2 rounded-xl ${isFestivo ? 'bg-danger-light' : 'bg-muted'}`}>
          <Text className={`text-[10px] font-medium ${isFestivo ? 'text-danger' : 'text-muted-foreground'}`}>
            {SHORT_DAYS[new Date(`${registro.fecha}T00:00:00`).getDay()]}
          </Text>
          <Text className={`text-base font-bold ${isFestivo ? 'text-danger' : 'text-foreground'}`}>
            {new Date(`${registro.fecha}T00:00:00`).getDate()}
          </Text>
        </View>

        {/* Time range */}
        <View className="flex-1 gap-0.5">
          <Text className="text-sm font-medium text-foreground">
            {fmtTime(registro.hora_entrada)} → {fmtTime(registro.hora_salida)}
          </Text>
          <View className="flex-row gap-2 flex-wrap">
            {h(ord)  && <Text className="text-xs text-muted-foreground">{h(ord)}h ord.</Text>}
            {h(exd)  && <Text className="text-xs text-primary-500 font-medium">+{h(exd)}h ext.d</Text>}
            {h(exn)  && <Text className="text-xs text-primary-600 font-medium">+{h(exn)}h ext.n</Text>}
            {h(noc)  && <Text className="text-xs text-info font-medium">{h(noc)}h noc.</Text>}
            {h(fest) && <Text className="text-xs text-danger font-medium">{h(fest)}h fest.</Text>}
          </View>
        </View>

        {/* Total hours + expand indicator */}
        <View className="items-end gap-1">
          <Text className="text-base font-bold text-foreground">{total.toFixed(1)}h</Text>
          {(hasExtras || registro.novedad) && (
            <Text className="text-xs text-muted-foreground">{expanded ? '▲' : '▼'}</Text>
          )}
        </View>
      </View>

      {/* ── Expanded: novedad ─────────────────────────────────── */}
      {expanded && registro.novedad && (
        <View className="px-4 pb-3 pt-0 border-t border-border">
          <Text className="text-xs text-muted-foreground mt-2">Novedad</Text>
          <Text className="text-sm text-foreground mt-0.5">{registro.novedad}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}
