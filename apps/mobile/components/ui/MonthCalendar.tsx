import { Text } from '@/components/ui/Text';
import React from 'react';
import { View, TouchableOpacity } from 'react-native';
import { alpha, COLORS } from '@/lib/designTokens';
import { useTheme } from '@/lib/theme';
import type { CalendarDay } from '@/lib/calendar';

const DIAS_SEMANA = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

/** Mes en cuadrícula con el color del perfil: cabecera de días tintada, hoy resaltado y fines de semana marcados. */
export function MonthCalendar({
  weeks, renderDay, onDayPress,
}: {
  weeks: CalendarDay[][];
  renderDay: (day: CalendarDay) => React.ReactNode;
  onDayPress?: (day: CalendarDay) => void;
}) {
  const theme = useTheme();
  return (
    <View className="bg-card border border-border rounded-3xl overflow-hidden">
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
            return (
              <Cell
                key={day.date}
                {...(onDayPress ? { onPress: () => onDayPress(day), activeOpacity: 0.6 } : {})}
                className={`flex-1 p-1 gap-1 min-h-16 ${day.inCurrentMonth ? '' : 'opacity-30'}`}
                style={day.isToday ? { backgroundColor: alpha(theme.primary, 0.07) } : undefined}
              >
                <View
                  className="w-6 h-6 rounded-full items-center justify-center"
                  style={day.isToday ? { backgroundColor: theme.primary } : undefined}
                >
                  <Text
                    className={`text-[11px] ${day.isToday ? 'font-bold' : 'font-medium'}`}
                    style={{ color: day.isToday ? COLORS.white : COLORS.mutedForeground }}
                  >
                    {Number(day.date.slice(8, 10))}
                  </Text>
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
