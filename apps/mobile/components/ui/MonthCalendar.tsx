import { Text } from '@/components/ui/Text';
import React, { useMemo, useRef } from 'react';
import { View, TouchableOpacity, PanResponder } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { nombreFestivo } from '@api-client';
import { alpha, COLORS } from '@/lib/designTokens';
import { useTheme } from '@/lib/theme';
import { etiquetaDia, type CalendarDay } from '@/lib/calendar';

const DIAS_SEMANA = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

/** Mes en cuadrícula con el color del perfil: cabecera de días tintada, hoy resaltado y fines de semana marcados. */
const UMBRAL_DESLIZAR = 50;

export function MonthCalendar({
  weeks, renderDay, onDayPress, selectedDate, onMesAnterior, onMesSiguiente,
}: {
  weeks: CalendarDay[][];
  renderDay: (day: CalendarDay) => React.ReactNode;
  onDayPress?: (day: CalendarDay) => void;
  /** Día marcado (borde del color del perfil). */
  selectedDate?: string;
  /** Si se pasan, deslizar el calendario a derecha/izquierda cambia de mes. */
  onMesAnterior?: () => void;
  onMesSiguiente?: () => void;
}) {
  const theme = useTheme();
  // Los callbacks cambian en cada render: el ref evita recrear el PanResponder.
  const gestos = useRef({ onMesAnterior, onMesSiguiente });
  gestos.current = { onMesAnterior, onMesSiguiente };
  const pan = useMemo(() => PanResponder.create({
    // Solo toma el gesto si es claramente horizontal; los toques y el scroll vertical pasan de largo.
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 18 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
    onPanResponderRelease: (_, g) => {
      if (g.dx <= -UMBRAL_DESLIZAR) gestos.current.onMesSiguiente?.();
      else if (g.dx >= UMBRAL_DESLIZAR) gestos.current.onMesAnterior?.();
    },
  }), []);
  return (
    <View className="bg-card border border-border rounded-3xl overflow-hidden" {...pan.panHandlers}>
      <View className="flex-row px-1 py-2.5" style={{ backgroundColor: alpha(theme.primary, 0.1) }}>
        {DIAS_SEMANA.map((d, i) => (
          <Text
            key={i}
            className="flex-1 text-center text-[11px] font-bold uppercase"
            style={{ color: i >= 5 ? theme.primary : COLORS.mutedForeground }}
          >
            {d}
          </Text>
        ))}
      </View>
      {weeks.map((week, wi) => (
        <View key={wi} className={`flex-row ${wi > 0 ? 'border-t border-border/40' : ''}`}>
          {week.map(day => {
            const Cell = onDayPress ? TouchableOpacity : View;
            const festivo = nombreFestivo(day.date);
            return (
              <Cell
                key={day.date}
                {...(onDayPress ? { onPress: () => onDayPress(day), activeOpacity: 0.6 } : {})}
                className={`flex-1 p-1 gap-1 min-h-16 ${day.inCurrentMonth ? '' : 'opacity-30'}`}
                style={[
                  day.isToday ? { backgroundColor: alpha(theme.primary, 0.07) } : null,
                  day.date === selectedDate ? { borderWidth: 2, borderColor: theme.primary, borderRadius: 12 } : null,
                ]}
                accessibilityLabel={festivo ? `${etiquetaDia(day.date)}, festivo: ${festivo}` : etiquetaDia(day.date)}
                accessibilityState={{ selected: day.date === selectedDate }}
              >
                <View className="flex-row items-center gap-0.5">
                  <View
                    className="w-6 h-6 rounded-full items-center justify-center"
                    style={day.isToday ? { backgroundColor: theme.primary } : undefined}
                  >
                    <Text
                      className={`text-[11px] ${day.isToday || festivo ? 'font-bold' : 'font-medium'}`}
                      style={{ color: day.isToday ? COLORS.white : festivo ? theme.primary : COLORS.mutedForeground }}
                    >
                      {Number(day.date.slice(8, 10))}
                    </Text>
                  </View>
                  {festivo && <Ionicons name="flag" size={9} color={theme.primary} />}
                </View>
                {renderDay(day)}
              </Cell>
            );
          })}
        </View>
      ))}
    </View>
  );
}
