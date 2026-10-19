import React, { useEffect, useRef } from 'react';
import { Animated, Easing, View, type StyleProp, type ViewStyle } from 'react-native';
import { COLORS } from '@/lib/designTokens';
import { t } from '@/lib/i18n';

const SIZES = { small: 20, large: 36 } as const;

interface SpinnerProps {
  /** Mismos valores que ActivityIndicator, o un número en px. */
  size?: keyof typeof SIZES | number;
  /** Color del arco; la pista (anillo tenue) usa el mismo color. Por defecto, naranja de marca. */
  color?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * Spinner de marca: anillo tenue + arco que gira. Reemplaza a ActivityIndicator
 * (API compatible: `size` y `color`) para que toda la app cargue con la misma identidad.
 */
export function Spinner({ size = 'small', color = COLORS.primary, style }: SpinnerProps) {
  const px = typeof size === 'number' ? size : SIZES[size];
  const borderWidth = Math.max(2, Math.round(px / 9));
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(spin, { toValue: 1, duration: 800, easing: Easing.linear, useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [spin]);

  const ring = { width: px, height: px, borderRadius: px / 2, borderWidth } as const;

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={t('common.loading')}
      style={[{ width: px, height: px }, style]}
    >
      <View style={[ring, { position: 'absolute', borderColor: color, opacity: 0.25 }]} />
      <Animated.View
        style={[
          ring,
          {
            borderColor: 'transparent',
            borderTopColor: color,
            transform: [{ rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }],
          },
        ]}
      />
    </View>
  );
}
