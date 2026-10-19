import React from 'react';
import Svg, { Circle, Ellipse, G, Path } from 'react-native-svg';
import { COLORS } from '@/lib/designTokens';

/**
 * Errores: `fallen` = anillo en el suelo (sin conexión) · `tilted` = anillo torcido y roto (falla del servidor).
 * Vacíos: `orbit` = nada todavía · `search` = sin resultados (lupa) · `done` = todo al día (visto verde).
 */
export type PlanetVariant = 'fallen' | 'tilted' | 'orbit' | 'search' | 'done';

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
      {variant === 'fallen' && (
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
      )}
      {variant === 'tilted' && (
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
      {(variant === 'orbit' || variant === 'done') && (
        <>
          <G fill={COLORS.placeholder} fillOpacity={0.5}>
            <Circle cx={26} cy={34} r={2} /><Circle cx={170} cy={26} r={2.5} />
            <Circle cx={176} cy={110} r={1.8} /><Circle cx={30} cy={116} r={1.8} />
          </G>
          <Ellipse cx={100} cy={148} rx={40} ry={5} fill={COLORS.border} />
          <Ellipse cx={100} cy={80} rx={76} ry={18} rotation={-18} origin="100, 80" fill="none" strokeOpacity={0.4} {...ring} />
          <Circle cx={100} cy={80} r={40} fill={COLORS.primary} />
          <G transform="translate(0 18)">{highlight}</G>
          <G rotation={-18} origin="100, 80">
            <Path d="M24 80A76 18 0 0 0 176 80" fill="none" strokeLinecap="round" {...ring} />
          </G>
          {variant === 'done' && (
            <>
              <Circle cx={150} cy={38} r={20} fill={COLORS.success} stroke={COLORS.white} strokeWidth={4} />
              <Path d="M141 38l7 7 13-14" stroke={COLORS.white} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </>
          )}
        </>
      )}
      {variant === 'search' && (
        <>
          <G fill={COLORS.placeholder} fillOpacity={0.5}>
            <Circle cx={26} cy={34} r={2} /><Circle cx={172} cy={22} r={2.5} /><Circle cx={24} cy={112} r={1.8} />
          </G>
          <Ellipse cx={88} cy={70} rx={68} ry={16} rotation={-18} origin="88, 70" fill="none" strokeOpacity={0.4} {...ring} strokeWidth={8} />
          <Circle cx={88} cy={70} r={36} fill={COLORS.primary} />
          <Path d="M64 50a30 30 0 0 1 21-12" stroke={COLORS.white} strokeOpacity={0.45} strokeWidth={5} strokeLinecap="round" fill="none" />
          <G rotation={-18} origin="88, 70">
            <Path d="M26 70A68 16 0 0 0 150 70" fill="none" strokeLinecap="round" {...ring} strokeWidth={8} />
          </G>
          <Path d="M152 124l18 18" stroke={COLORS.foreground} strokeWidth={9} strokeLinecap="round" />
          <Circle cx={138} cy={110} r={22} fill={COLORS.white} fillOpacity={0.85} stroke={COLORS.foreground} strokeWidth={7} />
        </>
      )}
    </Svg>
  );
}
