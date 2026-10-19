import React from 'react';
import Svg, { Circle, Ellipse, G, Path } from 'react-native-svg';
import { COLORS } from '@/lib/designTokens';

/** `fallen` = anillo en el suelo (sin conexión) · `tilted` = anillo torcido y roto (falla del servidor). */
export type PlanetVariant = 'fallen' | 'tilted';

interface Props {
  variant: PlanetVariant;
  /** Ancho en px; el alto sigue la proporción 200:160. */
  width?: number;
}

/**
 * Planeta del logo con su anillo fuera de lugar. Mismo trazo que
 * apps/web/src/shared/components/PlanetIllustration.tsx — si cambias uno, cambia el otro.
 */
export function PlanetIllustration({ variant, width = 200 }: Props) {
  const ring = { stroke: COLORS.primary, strokeWidth: 9 } as const;
  const highlight = <Path d="M72 40a34 34 0 0 1 24-14" stroke={COLORS.white} strokeOpacity={0.45} strokeWidth={5} strokeLinecap="round" fill="none" />;

  return (
    <Svg width={width} height={(width * 160) / 200} viewBox="0 0 200 160" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {variant === 'fallen' ? (
        <>
          <G fill={COLORS.placeholder}>
            <Circle cx={24} cy={30} r={2} /><Circle cx={172} cy={22} r={2.5} />
            <Circle cx={160} cy={70} r={1.8} /><Circle cx={36} cy={82} r={1.8} />
          </G>
          <Ellipse cx={100} cy={148} rx={52} ry={6} fill={COLORS.border} />
          <Ellipse cx={100} cy={134} rx={60} ry={13} rotation={-8} origin="100, 134" fill="none" strokeOpacity={0.4} {...ring} />
          <Path d="M58 98v10M100 108v8M142 98v10" stroke={COLORS.primary} strokeOpacity={0.35} strokeWidth={3} strokeLinecap="round" />
          <Circle cx={100} cy={62} r={40} fill={COLORS.primary} />
          {highlight}
        </>
      ) : (
        <>
          <G fill={COLORS.placeholder}>
            <Circle cx={24} cy={30} r={2} /><Circle cx={172} cy={22} r={2.5} />
            <Circle cx={168} cy={120} r={1.8} /><Circle cx={30} cy={124} r={1.8} />
          </G>
          <Ellipse cx={100} cy={80} rx={74} ry={19} rotation={-48} origin="100, 80" fill="none" strokeOpacity={0.4} {...ring} />
          <Circle cx={100} cy={80} r={40} fill={COLORS.primary} />
          <G transform="translate(0 18)">{highlight}</G>
          <G rotation={-48} origin="100, 80">
            <Path d="M26 80A74 19 0 0 0 174 80" fill="none" strokeLinecap="round" strokeDasharray="148 999" {...ring} />
          </G>
          <Path d="M150 36l8-8M158 52h10M142 22v-9" stroke={COLORS.warning} strokeWidth={4} strokeLinecap="round" />
        </>
      )}
    </Svg>
  );
}
