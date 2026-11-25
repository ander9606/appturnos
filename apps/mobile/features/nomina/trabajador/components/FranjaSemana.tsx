/**
 * FranjaSemana — los 7 días de una semana (lun–dom) como celdas, con lo que cae dentro del período en color y lo
 * que cae fuera (período anterior o siguiente) atenuado, y debajo una etiqueta corta por tramo. Reemplaza las tres
 * líneas de texto "Período anterior · rango · horas / Este período · … / Período siguiente · …": el corte del
 * período se ve donde está, entre dos días. El día de un compensatorio lleva una cama en lugar del número.
 */
import { Text } from '@/components/ui/Text';
import React from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/lib/designTokens';
import { diasSemanaEnPeriodo, tramosContiguos, fmtFechaCorta, type ZonaDia } from '../nominaTrabajadorUtils';

function etiqueta(zona: ZonaDia, horas?: number): string {
  const h = horas !== undefined && horas > 0 ? ` · ${horas.toFixed(1)}h` : '';
  return zona === 'este' ? `Este período${h}` : zona === 'anterior' ? `Anterior${h}` : 'Siguiente';
}

export function FranjaSemana({ lunes, periodo, horasAnterior, horasEste, fechasCompensatorio = [] }: {
  lunes: string;
  periodo: { fecha_inicio: string; fecha_fin: string };
  /** Horas de la semana que cayeron en el período anterior. */
  horasAnterior?: number;
  /** Horas de la semana que son de este período (sin lo acreditado por compensatorio). */
  horasEste?: number;
  /** Días de la semana en que se toma un compensatorio. */
  fechasCompensatorio?: string[];
}) {
  const dias = diasSemanaEnPeriodo(lunes, periodo.fecha_inicio, periodo.fecha_fin);
  const tramos = tramosContiguos(dias);
  const resumen = tramos.map((t) => `${t.n} ${t.n === 1 ? 'día' : 'días'} ${t.zona === 'este' ? 'de este período' : t.zona === 'anterior' ? 'del período anterior' : 'del período siguiente'}`).join(', ');

  return (
    <View
      accessible
      accessibilityLabel={`Semana del ${fmtFechaCorta(lunes)}: ${resumen}${fechasCompensatorio.length ? `. Descanso compensatorio el ${fechasCompensatorio.map(fmtFechaCorta).join(' y ')}` : ''}`}
    >
      <View className="flex-row">
        {dias.map((d) => {
          const dentro = d.zona === 'este';
          const comp = fechasCompensatorio.includes(d.fecha);
          return (
            <View
              key={d.fecha}
              className={`flex-1 h-7 mx-0.5 rounded-md items-center justify-center ${dentro ? 'bg-success-light' : 'bg-muted'}`}
            >
              {comp ? (
                <Ionicons name="bed-outline" size={14} color={COLORS.info} />
              ) : (
                <Text className={`text-[11px] ${dentro ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>
                  {Number(d.fecha.slice(8))}
                </Text>
              )}
            </View>
          );
        })}
      </View>
      <View className="flex-row mt-1">
        {tramos.map((t, i) => (
          <View key={i} style={{ flex: t.n }} className="px-0.5 gap-0.5">
            <View className={`h-0.5 rounded-full ${t.zona === 'este' ? 'bg-success' : 'bg-border'}`} />
            <Text numberOfLines={1} className={`text-[10px] ${t.zona === 'este' ? 'font-medium text-foreground' : 'text-muted-foreground'}`}>
              {etiqueta(t.zona, t.zona === 'este' ? horasEste : t.zona === 'anterior' ? horasAnterior : undefined)}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}
