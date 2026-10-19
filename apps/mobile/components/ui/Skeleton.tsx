import React, { useEffect } from 'react';
import { Animated, View, type DimensionValue, type StyleProp, type ViewStyle } from 'react-native';
import { COLORS } from '@/lib/designTokens';
import { t } from '@/lib/i18n';

// Un solo pulso compartido: todos los skeletons visibles laten al unísono (se ve más
// ordenado que cada uno con su propio ritmo) y la animación se apaga sola sin ninguno montado.
const pulse = new Animated.Value(1);
let montados = 0;
let loop: Animated.CompositeAnimation | null = null;

function usePulse() {
  useEffect(() => {
    if (montados++ === 0) {
      loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 0.45, duration: 700, useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        ]),
      );
      loop.start();
    }
    return () => {
      if (--montados === 0) { loop?.stop(); pulse.setValue(1); }
    };
  }, []);
  return pulse;
}

interface SkeletonProps {
  width?: DimensionValue;
  height?: number;
  /** 'full' = círculo (avatares). */
  radius?: number | 'full';
  style?: StyleProp<ViewStyle>;
}

/** Bloque gris pulsante que ocupa el lugar de un texto, imagen o avatar mientras cargan los datos. */
export function Skeleton({ width = '100%', height = 14, radius = 6, style }: SkeletonProps) {
  const opacity = usePulse();
  const borderRadius = radius === 'full' ? height / 2 : radius;
  return (
    <Animated.View
      style={[{ width, height, borderRadius, backgroundColor: COLORS.border, opacity }, style]}
    />
  );
}

/** Tarjeta de lista genérica: avatar + dos líneas + etiqueta. Calca el tamaño de las tarjetas reales. */
export function SkeletonCard() {
  return (
    <View className="bg-card rounded-2xl border border-border p-4 flex-row items-center gap-3">
      <Skeleton width={44} height={44} radius="full" />
      <View className="flex-1 gap-2">
        <Skeleton width="60%" height={14} />
        <Skeleton width="40%" height={12} />
      </View>
      <Skeleton width={56} height={22} radius={11} />
    </View>
  );
}

/** Lista de N tarjetas skeleton. Se anuncia como "Cargando…" para lectores de pantalla. */
export function SkeletonList({ count = 5, style }: { count?: number; style?: StyleProp<ViewStyle> }) {
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={t('common.loading')}
      importantForAccessibility="no-hide-descendants"
      className="gap-3"
      style={style}
    >
      {Array.from({ length: count }, (_, i) => <SkeletonCard key={i} />)}
    </View>
  );
}

/** Marco común de los skeletons de pantalla: se anuncia como "Cargando…" y oculta los bloques a lectores de pantalla. */
function Cargando({ style, children }: { style?: StyleProp<ViewStyle>; children: React.ReactNode }) {
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={t('common.loading')}
      importantForAccessibility="no-hide-descendants"
      className="gap-4"
      style={style}
    >
      {children}
    </View>
  );
}

/** Pantalla de detalle: tarjeta de cabecera (avatar + título) y dos tarjetas de datos (etiqueta + valor). */
export function SkeletonDetail({ style }: { style?: StyleProp<ViewStyle> }) {
  const fila = (i: number) => (
    <View key={i} className="gap-1.5">
      <Skeleton width="30%" height={11} />
      <Skeleton width={i % 2 ? '55%' : '75%'} height={15} />
    </View>
  );
  return (
    <Cargando style={style}>
      <View className="bg-card rounded-2xl border border-border p-4 flex-row items-center gap-3">
        <Skeleton width={56} height={56} radius="full" />
        <View className="flex-1 gap-2">
          <Skeleton width="55%" height={16} />
          <Skeleton width="35%" height={12} />
        </View>
      </View>
      <View className="bg-card rounded-2xl border border-border p-4 gap-4">{[0, 1, 2, 3].map(fila)}</View>
      <View className="bg-card rounded-2xl border border-border p-4 gap-4">{[0, 1, 2].map(fila)}</View>
    </Cargando>
  );
}

/** Panel de métricas: cuadrícula de 2×2 tarjetas con un número grande, y una lista debajo. */
export function SkeletonStats({ style }: { style?: StyleProp<ViewStyle> }) {
  const tarjeta = (i: number) => (
    <View key={i} className="flex-1 bg-card rounded-2xl border border-border p-4 gap-2">
      <Skeleton width="45%" height={12} />
      <Skeleton width="60%" height={28} radius={8} />
    </View>
  );
  return (
    <Cargando style={style}>
      <View className="flex-row gap-3">{[0, 1].map(tarjeta)}</View>
      <View className="flex-row gap-3">{[2, 3].map(tarjeta)}</View>
      <SkeletonList count={3} />
    </Cargando>
  );
}
