/**
 * Dashboard — Tab "Inicio"
 * Pantalla principal post-login. WIP: implementación completa en próxima iteración.
 */
import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuthStore } from '@/features/auth/useAuthStore';
import { Button } from '@/components/ui/Button';
import { t } from '@/lib/i18n';

export default function DashboardScreen() {
  const usuario = useAuthStore((s) => s.usuario);
  const logout  = useAuthStore((s) => s.logout);

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? t('dashboard.greeting')
    : hour < 20 ? t('dashboard.greetingEvening')
    : t('dashboard.greetingNight');

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <ScrollView
        contentContainerClassName="flex-grow pb-6"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ─────────────────────────────────────────────────── */}
        <View className="bg-primary-500 pt-4 pb-8 px-6 rounded-b-[32px] gap-1">
          <Text className="text-white/80 text-sm font-medium">{greeting} 👋</Text>
          <View className="flex-row items-center justify-between">
            <Text className="text-white text-2xl font-bold">
              {usuario?.nombre ?? '…'}
            </Text>
            <TouchableOpacity
              className="w-10 h-10 rounded-xl bg-white/20 items-center justify-center"
              accessibilityLabel="Notificaciones"
            >
              <Text className="text-lg">🔔</Text>
            </TouchableOpacity>
          </View>
          <Text className="text-white/60 text-xs capitalize">{usuario?.rol?.replace(/_/g, ' ')}</Text>
        </View>

        {/* ── Stat cards ─────────────────────────────────────────────── */}
        <View className="flex-row px-6 mt-6 gap-3">
          {[
            { v: '3',  l: t('dashboard.statShiftsToday'), c: 'text-primary-500' },
            { v: '12', l: t('dashboard.statEmployees'),   c: 'text-success' },
            { v: '2',  l: t('dashboard.statRequests'),    c: 'text-warning' },
          ].map((s) => (
            <View
              key={s.l}
              className="flex-1 bg-card rounded-2xl p-4 gap-1 shadow-sm"
              style={{ elevation: 2 }}
            >
              <Text className={`text-2xl font-extrabold ${s.c}`}>{s.v}</Text>
              <Text className="text-xs text-muted-foreground">{s.l}</Text>
            </View>
          ))}
        </View>

        {/* ── Próximo turno (placeholder) ─────────────────────────────── */}
        <View className="mx-6 mt-6 bg-primary-500 rounded-2xl p-5 gap-3">
          <View className="flex-row items-center justify-between">
            <Text className="text-white/80 text-xs font-semibold uppercase tracking-wide">
              {t('dashboard.activeShift')}
            </Text>
            <View className="bg-white/20 rounded-full px-3 py-1 flex-row items-center gap-1">
              <View className="w-1.5 h-1.5 rounded-full bg-white" />
              <Text className="text-white text-xs font-semibold">{t('dashboard.inProgress')}</Text>
            </View>
          </View>
          <Text className="text-white text-xl font-bold">Turno Mañana</Text>
          <Text className="text-white/80 text-sm">8:00 – 14:00  ·  Recepción</Text>
          {/* Progress bar */}
          <View className="h-1.5 bg-white/30 rounded-full overflow-hidden">
            <View className="h-full w-3/5 bg-white rounded-full" />
          </View>
          <Text className="text-white/70 text-xs">3h restantes · 59% completado</Text>
        </View>

        {/* ── Acciones rápidas ─────────────────────────────────────────── */}
        <View className="px-6 mt-6 gap-3">
          <Text className="text-base font-semibold text-foreground">
            {t('dashboard.quickActions')}
          </Text>
          <View className="flex-row flex-wrap gap-3">
            {[
              { icon: '➕', label: 'Nuevo turno',  bg: 'bg-primary-50' },
              { icon: '📋', label: 'Ver nómina',   bg: 'bg-success-light' },
              { icon: '👤', label: 'Añadir emp.',  bg: 'bg-info-light' },
              { icon: '📊', label: 'Reportes',     bg: 'bg-muted' },
            ].map((a) => (
              <TouchableOpacity
                key={a.label}
                className={`${a.bg} rounded-2xl p-4 items-center gap-2`}
                style={{ width: '22%' }}
                accessibilityRole="button"
                accessibilityLabel={a.label}
              >
                <View className="w-10 h-10 bg-white/60 rounded-xl items-center justify-center">
                  <Text className="text-xl">{a.icon}</Text>
                </View>
                <Text className="text-[10px] font-medium text-foreground text-center">{a.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ── Logout (dev shortcut) ─────────────────────────────────────── */}
        <View className="px-6 mt-8">
          <Button
            label="Cerrar sesión"
            variant="ghost"
            onPress={logout}
            fullWidth
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
