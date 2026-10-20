'use strict';

process.env.FIRMA_ENCRYPTION_KEY = process.env.FIRMA_ENCRYPTION_KEY
  || '1e307b0cccfa3f3c759291df3b8dc09d49325845672911ab77f707f8372729c2';

const { cifrar, descifrar } = require('../utils/firmaCrypto');

describe('firmaCrypto', () => {
  test('null/"" pasan igual, sin tocar la clave', () => {
    expect(cifrar(null)).toBeNull();
    expect(cifrar('')).toBeNull();
    expect(descifrar(null)).toBeNull();
    expect(descifrar('')).toBe('');
  });

  test('cifra y descifra de vuelta al mismo texto', () => {
    const original = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUA';
    const cifrado = cifrar(original);
    expect(cifrado).not.toBe(original);
    expect(cifrado).toMatch(/^[0-9a-f]+:[0-9a-f]+:[0-9a-f]+$/i);
    expect(descifrar(cifrado)).toBe(original);
  });

  test('dos cifrados del mismo texto no son iguales (IV aleatorio)', () => {
    const a = cifrar('misma firma');
    const b = cifrar('misma firma');
    expect(a).not.toBe(b);
    expect(descifrar(a)).toBe('misma firma');
    expect(descifrar(b)).toBe('misma firma');
  });

  test('un valor en texto plano (fila de antes de este cambio) se devuelve tal cual, sin reventar', () => {
    const svgPlano = 'PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmci...';
    expect(descifrar(svgPlano)).toBe(svgPlano);
  });

  test('cifrado corrupto/manipulado no se descifra silenciosamente — se devuelve tal cual', () => {
    const cifrado = cifrar('firma real');
    const [iv, tag, datos] = cifrado.split(':');
    const manipulado = `${iv}:${tag}:${datos.slice(0, -2)}00`; // últimos bytes cambiados
    expect(descifrar(manipulado)).toBe(manipulado); // GCM detecta la manipulación y falla el auth tag
  });

  test('sin FIRMA_ENCRYPTION_KEY, cifrar() lanza en vez de guardar en claro por accidente', () => {
    const clave = process.env.FIRMA_ENCRYPTION_KEY;
    delete process.env.FIRMA_ENCRYPTION_KEY;
    expect(() => cifrar('algo')).toThrow(/FIRMA_ENCRYPTION_KEY/);
    process.env.FIRMA_ENCRYPTION_KEY = clave;
  });
});
