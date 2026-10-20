import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, Ellipse, LinearGradient, Rect, Stop } from 'react-native-svg';

import { Text } from '@/components/ui/Text';
import { COLORS, alpha } from '@/lib/designTokens';

/**
 * Piezas de marca de Reportes (mismo lenguaje que la bienvenida): degradado naranja con órbitas,
 * el planeta del logo de fondo y el anillo como gráfico de progreso. Todo estático y decorativo.
 */

const ORBITAS = [
  { rx: 150, ry: 50, o: 0.18 },
  { rx: 215, ry: 74, o: 0.12 },
  { rx: 290, ry: 100, o: 0.07 },
];

/** Encabezado de pantalla: degradado de marca, órbitas finas y el planeta tenue a la derecha. */
export function HeroMarca({ children }: { children: React.ReactNode }) {
  return (
    <View style={estilos.hero}>
      <Svg style={StyleSheet.absoluteFill} viewBox="0 0 390 240" preserveAspectRatio="xMidYMid slice">
        <Defs>
          <LinearGradient id="heroReportes" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={COLORS.primary} />
            <Stop offset="1" stopColor={COLORS.primary600} />
          </LinearGradient>
        </Defs>
        <Rect width="390" height="240" fill="url(#heroReportes)" />
        {ORBITAS.map((e) => (
          <Ellipse
            key={e.rx}
            cx={320} cy={70} rx={e.rx} ry={e.ry}
            rotation={25} origin="320, 70"
            fill="none" stroke={alpha(COLORS.white, e.o)} strokeWidth={1.5}
          />
        ))}
        <Circle cx={40} cy={30} r={2} fill={alpha(COLORS.white, 0.4)} />
        <Circle cx={190} cy={22} r={2.5} fill={alpha(COLORS.white, 0.35)} />
      </Svg>
      <Image
        source={require('../../assets/logo-mark.png')}
        accessibilityElementsHidden
        importantForAccessibility="no"
        style={estilos.planeta}
      />
      {children}
    </View>
  );
}

/** Órbita decorativa para la esquina de una tarjeta, en el color del módulo. */
export function OrbitaDecor({ color }: { color: string }) {
  return (
    <View pointerEvents="none" style={estilos.orbitaCard} accessibilityElementsHidden importantForAccessibility="no">
      <Svg width={150} height={110} viewBox="0 0 150 110">
        {[{ rx: 48, ry: 17, o: 0.16 }, { rx: 70, ry: 25, o: 0.1 }].map((e) => (
          <Ellipse
            key={e.rx}
            cx={100} cy={30} rx={e.rx} ry={e.ry}
            rotation={25} origin="100, 30"
            fill="none" stroke={alpha(color, e.o)} strokeWidth={1.5}
          />
        ))}
        <Circle cx={100} cy={30} r={7} fill={alpha(color, 0.18)} />
      </Svg>
    </View>
  );
}

/** Anillo de progreso (el anillo del planeta): `pct` de 0 a 100, con el valor al centro. */
export function AnilloProgreso({ pct, color, size = 72, trazo = 8 }: { pct: number; color: string; size?: number; trazo?: number }) {
  const r = (size - trazo) / 2;
  const c = 2 * Math.PI * r;
  const lleno = Math.max(0, Math.min(100, pct)) / 100;
  return (
    <View style={{ width: size, height: size }} accessibilityRole="image" accessibilityLabel={`${Math.round(pct)} por ciento`}>
      <Svg width={size} height={size}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={alpha(color, 0.15)} strokeWidth={trazo} fill="none" />
        <Circle
          cx={size / 2} cy={size / 2} r={r}
          stroke={color} strokeWidth={trazo} fill="none" strokeLinecap="round"
          strokeDasharray={`${c * lleno} ${c}`}
          rotation={-90} origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      <View style={[StyleSheet.absoluteFill, estilos.centro]}>
        <Text className="text-base font-bold text-foreground">{Math.round(pct)}%</Text>
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  hero: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 26,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    overflow: 'hidden',
    backgroundColor: COLORS.primary,
  },
  planeta: { position: 'absolute', right: -34, top: -18, width: 170, height: 170, opacity: 0.16 },
  orbitaCard: { position: 'absolute', right: -24, top: -16 },
  centro: { alignItems: 'center', justifyContent: 'center' },
});
