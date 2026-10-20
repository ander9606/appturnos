'use strict';

// empresas.logo_url guarda, en la misma columna, un data URI subido o una URL
// externa vieja (migración 098). obtenerLogoBuffer() decodifica ambos casos a
// un Buffer que pdfkit sí entiende, y nunca lanza — un logo caído o corrupto
// no debe tumbar la generación de la cuenta de cobro.
const { obtenerLogoBuffer } = require('../utils/cuentaCobroPdf');

beforeEach(() => {
  global.fetch = jest.fn();
});

describe('obtenerLogoBuffer', () => {
  test('sin logo_url devuelve null', async () => {
    expect(await obtenerLogoBuffer(null)).toBeNull();
    expect(await obtenerLogoBuffer('')).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('data URI se decodifica directo, sin red', async () => {
    const png = Buffer.from('contenido-png-falso').toString('base64');
    const buffer = await obtenerLogoBuffer(`data:image/png;base64,${png}`);

    expect(buffer).toEqual(Buffer.from(png, 'base64'));
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('URL externa se descarga y se convierte a Buffer', async () => {
    const bytes = new Uint8Array([1, 2, 3]).buffer;
    global.fetch.mockResolvedValue({ ok: true, arrayBuffer: async () => bytes });

    const buffer = await obtenerLogoBuffer('https://cdn.example.com/logo.png');

    expect(global.fetch).toHaveBeenCalledWith('https://cdn.example.com/logo.png', expect.anything());
    expect(buffer).toEqual(Buffer.from(bytes));
  });

  test('URL externa que responde error (host caído, 404) devuelve null sin lanzar', async () => {
    global.fetch.mockResolvedValue({ ok: false, status: 404 });

    expect(await obtenerLogoBuffer('https://cdn.example.com/no-existe.png')).toBeNull();
  });

  test('fetch que lanza (timeout, DNS) devuelve null sin propagar el error', async () => {
    global.fetch.mockRejectedValue(new Error('timeout'));

    expect(await obtenerLogoBuffer('https://cdn.example.com/logo.png')).toBeNull();
  });
});
