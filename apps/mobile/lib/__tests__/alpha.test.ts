import { ACCENT, COLORS, alpha } from '../designTokens';

describe('alpha', () => {
  it('agrega el canal alfa en hex', () => {
    expect(alpha('#6366F1', 0.1)).toBe('#6366F11a');
    expect(alpha(COLORS.danger, 0.5)).toBe('#EF444480');
    expect(alpha(ACCENT.violeta, 1)).toBe('#8B5CF6ff');
    expect(alpha(COLORS.success, 0)).toBe('#05966900');
  });

  it('recorta opacidades fuera de 0..1', () => {
    expect(alpha('#000000', 2)).toBe('#000000ff');
    expect(alpha('#000000', -1)).toBe('#00000000');
  });

  it('si el color no es #RRGGBB lo devuelve igual en vez de inventar uno inválido', () => {
    expect(alpha('rgb(1,2,3)', 0.5)).toBe('rgb(1,2,3)');
    expect(alpha('#FFF', 0.5)).toBe('#FFF');
    expect(alpha('transparent', 0.5)).toBe('transparent');
  });
});
