import { familiaInter } from '../tipografia';

describe('familiaInter', () => {
  it('sin peso → Inter regular', () => {
    expect(familiaInter()).toBe('Inter_400Regular');
    expect(familiaInter('text-sm text-foreground')).toBe('Inter_400Regular');
  });

  it('traduce las clases font-*', () => {
    expect(familiaInter('font-medium')).toBe('Inter_500Medium');
    expect(familiaInter('text-base font-semibold text-foreground')).toBe('Inter_600SemiBold');
    expect(familiaInter('font-bold')).toBe('Inter_700Bold');
    expect(familiaInter('font-extrabold')).toBe('Inter_800ExtraBold');
  });

  it('gana la última clase font-* y se ignoran las variantes (active:, md:)', () => {
    expect(familiaInter('font-bold font-medium')).toBe('Inter_500Medium');
    expect(familiaInter('font-medium active:font-bold')).toBe('Inter_500Medium');
  });

  it('el fontWeight del estilo manda sobre la clase', () => {
    expect(familiaInter('font-medium', '700')).toBe('Inter_700Bold');
    expect(familiaInter(undefined, 'bold')).toBe('Inter_700Bold');
    expect(familiaInter(undefined, 'normal')).toBe('Inter_400Regular');
  });

  it('pesos intermedios o extremos van al disponible más cercano', () => {
    expect(familiaInter(undefined, 300)).toBe('Inter_400Regular');
    expect(familiaInter(undefined, '900')).toBe('Inter_800ExtraBold');
    expect(familiaInter(undefined, 'raro')).toBe('Inter_400Regular');
  });
});
