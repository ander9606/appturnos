// Inter mide 1.21× su tamaño de alto natural. Un interlineado menor recorta tildes y emojis en
// Android, así que ningún tamaño de texto puede bajar de 1.25 (docs/DISENO.md §3).
// eslint-disable-next-line @typescript-eslint/no-require-imports
const resolveConfig = require('tailwindcss/resolveConfig');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const config = resolveConfig(require('../../tailwind.config.js'));

const numero = (v: string) => parseFloat(v);
const MINIMO = 1.25;

describe('interlineado de los tamaños de texto', () => {
  const tamanos = Object.entries(config.theme.fontSize as Record<string, [string, { lineHeight: string }]>);

  it.each(tamanos)('text-%s tiene interlineado >= 1.25×', (_nombre, [fontSize, { lineHeight }]) => {
    const proporcion = /[a-z%]$/.test(lineHeight) ? numero(lineHeight) / numero(fontSize) : numero(lineHeight);
    expect(proporcion).toBeGreaterThanOrEqual(MINIMO - 1e-9);
  });
});
