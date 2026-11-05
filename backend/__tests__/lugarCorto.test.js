'use strict';

const { lugarCorto } = require('../utils/lugarCorto');

const LARGA = 'Corferias, Carrera 37, Quinta Paredes, Teusaquillo, Bogotá, Bogotá Distrito Capital, RAP (Especial) Central, 111321, Colombia';

describe('lugarCorto', () => {
  test('el nombre corto (alias) gana siempre, aunque haya dirección', () => {
    expect(lugarCorto(LARGA, '  Corferias ')).toBe('Corferias');
    expect(lugarCorto(null, 'Bodega Central')).toBe('Bodega Central');
  });

  test('una dirección que ya cabe en una línea se deja igual (nada cambia para lo que ya funcionaba)', () => {
    expect(lugarCorto('Bodega Central')).toBe('Bodega Central');
    expect(lugarCorto('Calle 100 # 15-20, Bogotá')).toBe('Calle 100 # 15-20, Bogotá');
  });

  test('la dirección larga de un buscador se reduce a sus dos primeras partes', () => {
    expect(lugarCorto(LARGA)).toBe('Corferias, Carrera 37');
  });

  test('salta las partes que son solo un número', () => {
    expect(lugarCorto('24, Carrera 37, Quinta Paredes, Teusaquillo, Bogotá, Bogotá Distrito Capital, Colombia')).toBe('Carrera 37, Quinta Paredes');
  });

  test('si aun así es muy largo, se corta con puntos suspensivos', () => {
    const largo = `${'Centro Internacional de Convenciones y Exposiciones '.repeat(2)}, Pabellón principal, Bogotá, Colombia, más texto`;
    const corto = lugarCorto(largo);
    expect(corto.length).toBeLessThanOrEqual(60);
    expect(corto.endsWith('…')).toBe(true);
  });

  test('sin lugar ni alias devuelve null; un alias en blanco no cuenta', () => {
    expect(lugarCorto(null)).toBeNull();
    expect(lugarCorto('   ', '  ')).toBeNull();
    expect(lugarCorto('Bodega', '   ')).toBe('Bodega');
  });
});
