/**
 * WeekStrip — barra de navegación semanal
 * Muestra los 7 días de la semana con dots para los días que tienen turnos.
 * El día seleccionado se resalta. Deslizable si hace falta.
 */
import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import type { WeekDay } from './turnosUtils';

interface WeekStripProps {
  days: WeekDay[];
  selectedDate: string;          // YYYY-MM-DD
  datesWithShifts: Set<string>;  // YYYY-MM-DD
  onSelectDate: (iso: string) => void;
}

export function WeekStrip({ days, selectedDate, datesWithShifts, onSelectDate }: WeekStripProps) {
  return (
    <View className="bg-card border-b border-border">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerClassName="flex-row px-4 py-3 gap-1"
      >
        {days.map((day) => {
          const isSelected = day.isoDate === selectedDate;
          const hasShifts  = datesWithShifts.has(day.isoDate);

          return (
            <TouchableOpacity
              key={day.isoDate}
              onPress={() => onSelectDate(day.isoDate)}
              className={[
                'items-center justify-center rounded-2xl px-3 py-2 min-w-[44px] gap-1',
                isSelected ? 'bg-primary-500' : day.isToday ? 'bg-primary-50' : 'bg-transparent',
              ].join(' ')}
              accessibilityRole="button"
              accessibilityLabel={`${day.dayLabel} ${day.dayNum}`}
              accessibilityState={{ selected: isSelected }}
            >
              {/* Day name */}
              <Text
                className={[
                  'text-[11px] font-medium',
                  isSelected ? 'text-white' : day.isToday ? 'text-primary-500' : 'text-muted-foreground',
                ].join(' ')}
              >
                {day.dayLabel}
              </Text>

              {/* Day number */}
              <Text
                className={[
                  'text-base font-bold',
                  isSelected ? 'text-white' : day.isToday ? 'text-primary-600' : 'text-foreground',
                ].join(' ')}
              >
                {day.dayNum}
              </Text>

              {/* Dot indicator */}
              <View className="h-1.5 items-center justify-center">
                {hasShifts && (
                  <View
                    className={[
                      'w-1.5 h-1.5 rounded-full',
                      isSelected ? 'bg-white' : 'bg-primary-400',
                    ].join(' ')}
                  />
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}
