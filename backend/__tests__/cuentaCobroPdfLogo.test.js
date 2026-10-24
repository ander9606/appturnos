'use strict';

// empresas.logo_url guarda, en la misma columna, un data URI subido o una URL
// externa vieja (migración 098). obtenerLogoBuffer() solo decodifica el data
// URI — las URLs externas no se descargan (SSRF: la URL la pone admin_empresa
// y el fetch lo haría el backend compartido) y se omiten sin romper el PDF.
const { obtenerLogoBuffer } = require('../utils/cuentaCobroPdf');

describe('obtenerLogoBuffer', () => {
  test('sin logo_url devuelve null', async () => {
    expect(await obtenerLogoBuffer(null)).toBeNull();
    expect(await obtenerLogoBuffer('')).toBeNull();
  });

  test('data URI se decodifica directo', async () => {
    const png = Buffer.from('contenido-png-falso').toString('base64');
    const buffer = await obtenerLogoBuffer(`data:image/png;base64,${png}`);

    expect(buffer).toEqual(Buffer.from(png, 'base64'));
  });

  test('URL externa (legacy) no se descarga, devuelve null', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch');

    expect(await obtenerLogoBuffer('https://cdn.example.com/logo.png')).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();

    fetchSpy.mockRestore();
  });
});
