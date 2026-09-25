import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import type { CalendarDay } from '@/lib/calendar';

const DIAS_SEMANA = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

export function MonthCalendar({
  weeks, renderDay, onDayPress,
}: {
  weeks: CalendarDay[][];
  renderDay: (day: CalendarDay) => React.ReactNode;
  onDayPress?: (day: CalendarDay) => void;
}) {
  return (
    <View className="bg-card border border-border rounded-2xl overflow-hidden">
      <View className="flex-row bg-muted px-1 py-2">
        {DIAS_SEMANA.map((d, i) => (
          <Text key={i} className="flex-1 text-center text-[10px] font-semibold text-muted-foreground uppercase">
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
              >
                <View className={`w-5 h-5 rounded-full items-center justify-center ${day.isToday ? 'bg-primary' : ''}`}>
                  <Text className={`text-[10px] font-medium ${day.isToday ? 'text-white' : 'text-muted-foreground'}`}>
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
