import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Circle, Ellipse, Path } from 'react-native-svg';
import { COLORS } from '@/lib/designTokens';
import { t } from '@/lib/i18n';

const ANCHO = 200;
const ALTO = 160;
const ring = { stroke: COLORS.primary, strokeWidth: 9 } as const;
const capa = { position: 'absolute', width: ANCHO, height: ALTO } as const;

/**
 * Carga a nivel de marca (arranque de la app): el planeta del logo con su anillo balanceándose
 * en órbita. Para cargas dentro de pantallas usa `Spinner` o skeletons.
 * ponytail: animación con Animated + SVG — upgrade path: Lottie (lottie-react-native) cuando haya nuevo build nativo.
 */
export function PlanetaCargando({ width = 160 }: { width?: number }) {
  const t01 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(t01, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(t01, { toValue: 0, duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [t01]);

  // El anillo (trasero y delantero) se inclina de -18° a +18° alrededor del planeta; el planeta respira.
  const rotate = t01.interpolate({ inputRange: [0, 1], outputRange: ['-18deg', '18deg'] });
  const escala = t01.interpolate({ inputRange: [0, 1], outputRange: [1, 1.04] });

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={t('common.loading')}
      style={{ width, height: (width * ALTO) / ANCHO }}
    >
      <View style={{ width: ANCHO, height: ALTO, transform: [{ scale: width / ANCHO }], transformOrigin: 'top left' }}>
        <Animated.View style={[capa, { transform: [{ rotate }] }]}>
          <Svg width={ANCHO} height={ALTO} viewBox="0 0 200 160">
            <Ellipse cx={100} cy={80} rx={76} ry={18} fill="none" strokeOpacity={0.4} {...ring} />
          </Svg>
        </Animated.View>
        <Animated.View style={[capa, { transform: [{ scale: escala }] }]}>
          <Svg width={ANCHO} height={ALTO} viewBox="0 0 200 160">
            <Circle cx={100} cy={80} r={40} fill={COLORS.primary} />
            <Path d="M72 58a34 34 0 0 1 24-14" stroke={COLORS.white} strokeOpacity={0.45} strokeWidth={5} strokeLinecap="round" fill="none" />
          </Svg>
        </Animated.View>
        <Animated.View style={[capa, { transform: [{ rotate }] }]}>
          <Svg width={ANCHO} height={ALTO} viewBox="0 0 200 160">
            <Path d="M24 80A76 18 0 0 0 176 80" fill="none" strokeLinecap="round" {...ring} />
          </Svg>
        </Animated.View>
      </View>
    </View>
  );
}

/** Pantalla completa de arranque, mientras se restaura la sesión. */
export function PantallaArranque() {
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: COLORS.background, alignItems: 'center', justifyContent: 'center' }]}>
      <PlanetaCargando />
    </View>
  );
}
