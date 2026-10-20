'use strict';

const { plantillaCorreo, esc, bloqueCodigo, tablaDatos } = require('../utils/plantillaCorreo');

describe('plantillaCorreo', () => {
  test('esc neutraliza HTML y comillas', () => {
    expect(esc('<script>"x"&\'y\'</script>')).toBe('&lt;script&gt;&quot;x&quot;&amp;&#39;y&#39;&lt;/script&gt;');
    expect(esc(null)).toBe('');
  });

  test('usa el naranja de marca y no el azul genérico', () => {
    const html = plantillaCorreo({ titulo: 'Hola', cuerpo: '<p>x</p>', nota: 'Una nota' });
    expect(html).toContain('#FF5A3C');
    expect(html).not.toContain('#2563eb');
    expect(html).toContain('Hola');
    expect(html).toContain('Una nota');
  });

  test('botón: escapa la url y el texto', () => {
    const html = plantillaCorreo({
      titulo: 't',
      cuerpo: '',
      boton: { texto: '<b>Pagar</b>', url: 'https://x.co/?a=1&b="2"' },
    });
    expect(html).toContain('&lt;b&gt;Pagar&lt;/b&gt;');
    expect(html).toContain('a=1&amp;b=&quot;2&quot;');
  });

  test('tablaDatos y bloqueCodigo escapan los valores', () => {
    expect(tablaDatos([['Email', '<i>a</i>']])).toContain('&lt;i&gt;a&lt;/i&gt;');
    expect(bloqueCodigo('<1>')).toContain('&lt;1&gt;');
  });
});
