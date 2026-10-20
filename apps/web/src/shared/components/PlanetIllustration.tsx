/**
 * Errores: `fallen` = anillo en el suelo (sin conexión) · `tilted` = anillo torcido y roto (falla del servidor).
 * Vacíos: `orbit` = nada todavía · `search` = sin resultados (lupa) · `done` = todo al día (visto verde).
 */
export type PlanetVariant = 'fallen' | 'tilted' | 'orbit' | 'search' | 'done';

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
      {variant === 'fallen' && (
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
      )}
      {variant === 'tilted' && (
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
      {(variant === 'orbit' || variant === 'done') && (
        <>
          <g className="fill-muted-foreground" fillOpacity=".5">
            <circle cx="26" cy="34" r="2" /><circle cx="170" cy="26" r="2.5" />
            <circle cx="176" cy="110" r="1.8" /><circle cx="30" cy="116" r="1.8" />
          </g>
          <ellipse cx="100" cy="148" rx="40" ry="5" className="fill-border" />
          <ellipse cx="100" cy="80" rx="76" ry="18" transform="rotate(-18 100 80)" className="stroke-primary" strokeOpacity=".4" strokeWidth="9" />
          <circle cx="100" cy="80" r="40" className="fill-primary" />
          <g transform="translate(0 18)">{highlight}</g>
          <path d="M24 80A76 18 0 0 0 176 80" transform="rotate(-18 100 80)" className="stroke-primary" strokeWidth="9" strokeLinecap="round" />
          {variant === 'done' && (
            <>
              <circle cx="150" cy="38" r="20" className="fill-success stroke-white" strokeWidth="4" />
              <path d="M141 38l7 7 13-14" className="stroke-white" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
            </>
          )}
        </>
      )}
      {variant === 'search' && (
        <>
          <g className="fill-muted-foreground" fillOpacity=".5">
            <circle cx="26" cy="34" r="2" /><circle cx="172" cy="22" r="2.5" /><circle cx="24" cy="112" r="1.8" />
          </g>
          <ellipse cx="88" cy="70" rx="68" ry="16" transform="rotate(-18 88 70)" className="stroke-primary" strokeOpacity=".4" strokeWidth="8" />
          <circle cx="88" cy="70" r="36" className="fill-primary" />
          <path d="M64 50a30 30 0 0 1 21-12" className="stroke-white" strokeOpacity=".45" strokeWidth="5" strokeLinecap="round" />
          <path d="M26 70A68 16 0 0 0 150 70" transform="rotate(-18 88 70)" className="stroke-primary" strokeWidth="8" strokeLinecap="round" />
          <path d="M152 124l18 18" className="stroke-foreground" strokeWidth="9" strokeLinecap="round" />
          <circle cx="138" cy="110" r="22" className="fill-card stroke-foreground" fillOpacity=".85" strokeWidth="7" />
        </>
      )}
    </svg>
  );
}
