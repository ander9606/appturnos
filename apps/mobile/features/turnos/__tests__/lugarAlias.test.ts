import { sugerirAlias } from '../lugarAlias';

describe('sugerirAlias', () => {
  test('toma la primera parte de la dirección larga de un buscador', () => {
    expect(sugerirAlias('Corferias, Carrera 37, Quinta Paredes, Teusaquillo, Bogotá, Colombia')).toBe('Corferias');
  });
  test('salta las partes que son solo un número', () => {
    expect(sugerirAlias('24, Carrera 37, Quinta Paredes, Bogotá')).toBe('Carrera 37');
  });
  test('si no hay nada que acortar no sugiere nada', () => {
    expect(sugerirAlias('Bodega Central')).toBeNull();
    expect(sugerirAlias('')).toBeNull();
    expect(sugerirAlias('12, 34')).toBeNull();
  });
  test('una primera parte que no cabe en 80 caracteres no se sugiere', () => {
    expect(sugerirAlias(`${'x'.repeat(81)}, Bogotá`)).toBeNull();
  });
});
