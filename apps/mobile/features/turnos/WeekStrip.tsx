/**
 * WeekStrip — barra de navegación semanal
 * Muestra los 7 días de la semana con dots para los días que tienen turnos.
 * El día seleccionado se resalta con primaryColor (default naranja).
 */
import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import type { WeekDay } from './turnosUtils';

interface WeekStripProps {
  days: WeekDay[];
  selectedDate: string;
  datesWithShifts: Set<string>;
  onSelectDate: (iso: string) => void;
  primaryColor?: string;
}

const DEFAULT_PRIMARY = '#FF5A3C';

export function WeekStrip({ days, selectedDate, datesWithShifts, onSelectDate, primaryColor = DEFAULT_PRIMARY }: WeekStripProps) {
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
              className="items-center justify-center rounded-2xl px-3 py-2 min-w-[44px] gap-1"
              style={{
                backgroundColor: isSelected
                  ? primaryColor
                  : day.isToday
                    ? primaryColor + '1A'
                    : 'transparent',
              }}
              accessibilityRole="button"
              accessibilityLabel={`${day.dayLabel} ${day.dayNum}`}
              accessibilityState={{ selected: isSelected }}
            >
              <Text
                className="text-[11px] font-medium"
                style={{
                  color: isSelected ? '#FFFFFF' : day.isToday ? primaryColor : '#64748B',
                }}
              >
                {day.dayLabel}
              </Text>

              <Text
                className="text-base font-bold"
                style={{
                  color: isSelected ? '#FFFFFF' : day.isToday ? primaryColor : '#0F172A',
                }}
              >
                {day.dayNum}
              </Text>

              <View className="h-1.5 items-center justify-center">
                {hasShifts && (
                  <View
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ backgroundColor: isSelected ? '#FFFFFF' : primaryColor }}
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
