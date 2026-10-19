/** `fallen` = anillo en el suelo (sin conexión) · `tilted` = anillo torcido y roto (falla del servidor). */
export type PlanetVariant = 'fallen' | 'tilted';

/**
 * Planeta del logo con su anillo fuera de lugar. Mismo trazo que
 * apps/mobile/components/ui/PlanetIllustration.tsx — si cambias uno, cambia el otro.
 */
export function PlanetIllustration({ variant, width = 200 }: { variant: PlanetVariant; width?: number }) {
  const highlight = (
    <path d="M72 40a34 34 0 0 1 24-14" className="stroke-white" strokeOpacity=".45" strokeWidth="5" strokeLinecap="round" fill="none" />
  );

  return (
    <svg width={width} height={(width * 160) / 200} viewBox="0 0 200 160" fill="none" aria-hidden="true">
      {variant === 'fallen' ? (
        <>
          <g className="fill-muted-foreground" fillOpacity=".5">
            <circle cx="24" cy="30" r="2" /><circle cx="172" cy="22" r="2.5" />
            <circle cx="160" cy="70" r="1.8" /><circle cx="36" cy="82" r="1.8" />
          </g>
          <ellipse cx="100" cy="148" rx="52" ry="6" className="fill-border" />
          <ellipse cx="100" cy="134" rx="60" ry="13" transform="rotate(-8 100 134)" className="stroke-primary" strokeOpacity=".4" strokeWidth="9" />
          <path d="M58 98v10M100 108v8M142 98v10" className="stroke-primary" strokeOpacity=".35" strokeWidth="3" strokeLinecap="round" />
          <circle cx="100" cy="62" r="40" className="fill-primary" />
          {highlight}
        </>
      ) : (
        <>
          <g className="fill-muted-foreground" fillOpacity=".5">
            <circle cx="24" cy="30" r="2" /><circle cx="172" cy="22" r="2.5" />
            <circle cx="168" cy="120" r="1.8" /><circle cx="30" cy="124" r="1.8" />
          </g>
          <ellipse cx="100" cy="80" rx="74" ry="19" transform="rotate(-48 100 80)" className="stroke-primary" strokeOpacity=".4" strokeWidth="9" />
          <circle cx="100" cy="80" r="40" className="fill-primary" />
          <g transform="translate(0 18)">{highlight}</g>
          <path d="M26 80A74 19 0 0 0 174 80" transform="rotate(-48 100 80)" className="stroke-primary" strokeWidth="9" strokeLinecap="round" strokeDasharray="148 999" />
          <path d="M150 36l8-8M158 52h10M142 22v-9" className="stroke-warning" strokeWidth="4" strokeLinecap="round" />
        </>
      )}
    </svg>
  );
}
