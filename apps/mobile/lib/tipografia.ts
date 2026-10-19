/**
 * Inter en React Native: cada peso es una familia distinta (no hay `fontWeight` sobre una sola
 * fuente), así que `font-semibold` (clase) o `fontWeight: '600'` (estilo) se traducen a
 * `Inter_600SemiBold`. Lo usa components/ui/Text.tsx; los pesos disponibles se cargan en app/_layout.tsx.
 */
export const INTER = {
  400: 'Inter_400Regular',
  500: 'Inter_500Medium',
  600: 'Inter_600SemiBold',
  700: 'Inter_700Bold',
  800: 'Inter_800ExtraBold',
} as const;

type Peso = keyof typeof INTER;

const PESO_POR_CLASE: Record<string, Peso> = {
  'font-normal': 400, 'font-medium': 500, 'font-semibold': 600, 'font-bold': 700, 'font-extrabold': 800,
};

/** Lleva cualquier fontWeight de CSS/RN al peso de Inter más cercano que se carga. */
function aPesoInter(fontWeight: string | number): Peso {
  const n = fontWeight === 'normal' ? 400 : fontWeight === 'bold' ? 700 : Number(fontWeight);
  if (!Number.isFinite(n) || n <= 400) return 400;
  if (n <= 500) return 500;
  if (n <= 600) return 600;
  if (n <= 700) return 700;
  return 800;
}

/**
 * Familia de Inter para un texto. El peso viene del `fontWeight` del estilo si lo trae (el
 * estilo se aplica después de la clase) y si no de la última clase `font-*`; sin ninguno, 400.
 */
export function familiaInter(className?: string, fontWeight?: string | number): string {
  if (fontWeight !== undefined) return INTER[aPesoInter(fontWeight)];
  const clases = (className ?? '').split(/\s+/);
  for (let i = clases.length - 1; i >= 0; i--) {
    const peso = PESO_POR_CLASE[clases[i]];
    if (peso) return INTER[peso];
  }
  return INTER[400];
}
