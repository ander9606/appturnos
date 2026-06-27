/**
 * WeekStrip — strip de fechas scrollable continuo.
 * Muestra ~7 semanas, auto-centra en hoy, dots en días con turnos.
 */
import React, { useRef, useEffect, useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { bogotaToday } from './turnosUtils';
import type { WeekDay } from './turnosUtils';

const ITEM_W  = 52; // ancho fijo por día (px) — necesario para scrollTo exacto
const ITEM_GAP = 4;
const SLOT_W  = ITEM_W + ITEM_GAP;

interface WeekStripProps {
  days: WeekDay[];
  selectedDate: string;
  datesWithShifts: Set<string>;
  onSelectDate: (iso: string) => void;
  primaryColor?: string;
}

const DEFAULT_PRIMARY = '#FF5A3C';

export function WeekStrip({
  days,
  selectedDate,
  datesWithShifts,
  onSelectDate,
  primaryColor = DEFAULT_PRIMARY,
}: WeekStripProps) {
  const scrollRef = useRef<ScrollView>(null);
  const today = useMemo(() => bogotaToday(), []);

  useEffect(() => {
    const todayIdx = days.findIndex((d) => d.isToday);
    if (todayIdx <= 0) return;
    // Center today: offset so today sits ~3 items from the left edge
    const x = Math.max(0, (todayIdx - 3) * SLOT_W);
    // Small timeout lets the ScrollView finish its layout before scrolling
    const t = setTimeout(() => scrollRef.current?.scrollTo({ x, animated: false }), 50);
    return () => clearTimeout(t);
  }, []); // run once on mount

  return (
    <View className="bg-card border-b border-border pt-2 pb-3">
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 12, flexDirection: 'row', gap: ITEM_GAP }}
      >
        {days.map((day, idx) => {
          const isSelected = day.isoDate === selectedDate;
          const hasShifts  = datesWithShifts.has(day.isoDate);
          const isPast     = !day.isToday && day.isoDate < today;
          // Show month label on the 1st of the month or the very first item
          const showMonth  = idx === 0 || day.dayNum === 1;

          return (
            <TouchableOpacity
              key={day.isoDate}
              onPress={() => onSelectDate(day.isoDate)}
              style={{
                width: ITEM_W,
                backgroundColor: isSelected
                  ? primaryColor
                  : day.isToday
                    ? primaryColor + '1A'
                    : 'transparent',
                borderRadius: 14,
              }}
              className="items-center py-2"
              accessibilityRole="button"
              accessibilityLabel={`${day.dayLabel} ${day.dayNum} ${day.monthLabel}`}
              accessibilityState={{ selected: isSelected }}
            >
              {/* Month badge — fixed height, invisible when not a boundary */}
              <Text
                style={{
                  fontSize: 9,
                  fontWeight: '700',
                  letterSpacing: 0.5,
                  height: 13,
                  color: isSelected ? 'rgba(255,255,255,0.8)' : primaryColor,
                  opacity: showMonth ? 1 : 0,
                }}
              >
                {day.monthLabel.toUpperCase()}
              </Text>

              <Text
                style={{
                  fontSize: 11,
                  fontWeight: '500',
                  marginTop: 1,
                  color: isSelected ? '#FFFFFF' : day.isToday ? primaryColor : isPast ? '#CBD5E1' : '#64748B',
                }}
              >
                {day.dayLabel}
              </Text>

              <Text
                style={{
                  fontSize: 16,
                  fontWeight: '700',
                  color: isSelected ? '#FFFFFF' : day.isToday ? primaryColor : isPast ? '#CBD5E1' : '#0F172A',
                }}
              >
                {day.dayNum}
              </Text>

              {/* Pill indicator — fixed height slot so rows stay aligned */}
              <View style={{ height: 6, alignItems: 'center', justifyContent: 'center', marginTop: 3 }}>
                {hasShifts && (
                  <View
                    style={{
                      width: 20,
                      height: 3,
                      borderRadius: 2,
                      backgroundColor: isSelected ? 'rgba(255,255,255,0.85)' : isPast ? '#CBD5E1' : primaryColor,
                    }}
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
