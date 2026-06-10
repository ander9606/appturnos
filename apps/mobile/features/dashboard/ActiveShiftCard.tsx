import React, { useEffect, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import type { Asignacion } from '@api-client';
import { fmtRange } from '@/features/turnos/turnosUtils';
import { t } from '@/lib/i18n';

function calcProgress(inicio: string, fin: string | null): number {
  if (!fin) return 0;
  const now = new Date();
  const [ih, im] = inicio.split(':').map(Number);
  const [fh, fm] = fin.split(':').map(Number);
  const start = new Date(); start.setHours(ih, im, 0, 0);
  const end   = new Date(); end.setHours(fh, fm, 0, 0);
  const total   = end.getTime() - start.getTime();
  const elapsed = now.getTime() - start.getTime();
  if (total <= 0) return 100;
  return Math.max(0, Math.min(100, (elapsed / total) * 100));
}

function minutesLeft(fin: string): number {
  const [fh, fm] = fin.split(':').map(Number);
  const end = new Date(); end.setHours(fh, fm, 0, 0);
  return Math.max(0, Math.round((end.getTime() - Date.now()) / 60_000));
}

function hoursLabel(mins: number): string {
  if (mins < 60) return `${mins}min restantes`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}min restantes` : `${h}h restantes`;
}

interface ActiveShiftCardProps {
  turno: Asignacion;
  primaryColor: string;
  onPress: () => void;
  onEgreso: () => void;
}

export function ActiveShiftCard({ turno, primaryColor, onPress, onEgreso }: ActiveShiftCardProps) {
  const [pct, setPct] = useState(() =>
    calcProgress(turno.hora_inicio, turno.hora_fin_estimada),
  );
  const [minsLeft, setMinsLeft] = useState(() =>
    turno.hora_fin_estimada ? minutesLeft(turno.hora_fin_estimada) : null,
  );

  useEffect(() => {
    const id = setInterval(() => {
      setPct(calcProgress(turno.hora_inicio, turno.hora_fin_estimada));
      if (turno.hora_fin_estimada) setMinsLeft(minutesLeft(turno.hora_fin_estimada));
    }, 60_000);
    return () => clearInterval(id);
  }, [turno.hora_inicio, turno.hora_fin_estimada]);

  return (
    <Pressable
      onPress={onPress}
      className="mx-4 mt-4 rounded-2xl p-5 gap-3 active:opacity-90"
      style={{ backgroundColor: primaryColor }}
    >
      <View className="flex-row items-center justify-between">
        <Text className="text-white/80 text-xs font-semibold uppercase tracking-wide">
          {t('dashboard.activeShift')}
        </Text>
        <View className="bg-white/20 rounded-full px-3 py-1 flex-row items-center gap-1">
          <View className="w-1.5 h-1.5 rounded-full bg-white" />
          <Text className="text-white text-xs font-semibold">{t('dashboard.inProgress')}</Text>
        </View>
      </View>

      <Text className="text-white text-xl font-bold" numberOfLines={1}>
        {turno.oferta_titulo}
      </Text>

      <Text className="text-white/80 text-sm">
        {fmtRange(turno.hora_inicio, turno.hora_fin_estimada)}
        {turno.lugar ? `  ·  ${turno.lugar}` : ''}
      </Text>

      <View className="h-1.5 bg-white/30 rounded-full overflow-hidden">
        <View
          className="h-full bg-white rounded-full"
          style={{ width: `${Math.round(pct)}%` }}
        />
      </View>

      <Text className="text-white/70 text-xs">
        {minsLeft != null ? hoursLabel(minsLeft) : ''}
        {'  ·  '}
        {pct.toFixed(0)}% completado
      </Text>

      <Pressable
        onPress={(e) => { e.stopPropagation(); onEgreso(); }}
        className="bg-white/20 rounded-xl py-2.5 items-center active:bg-white/30 mt-1"
      >
        <Text className="text-white text-sm font-semibold">Marcar Salida →</Text>
      </Pressable>
    </Pressable>
  );
}
