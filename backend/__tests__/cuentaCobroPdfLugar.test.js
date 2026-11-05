'use strict';

// En la línea de cargo y lugar del PDF va el nombre corto del lugar (o, sin él, una dirección larga acortada).
// Las cuentas ya generadas guardaron la dirección completa en el ítem: también se acortan al dibujarlas.
const { PassThrough } = require('stream');
const PDFDocument = require('pdfkit');
const { generarCuentaCobroPdf } = require('../utils/cuentaCobroPdf');

const LARGA = 'Corferias, Carrera 37, Quinta Paredes, Teusaquillo, Bogotá, Bogotá Distrito Capital, RAP (Especial) Central, 111321, Colombia';
const item = (n, lugar, extra = {}) => ({
  asignacion_id: n, fecha: `2030-01-0${n}`, descripcion: 'Montaje', cargo: 'Auxiliar de montaje', lugar, horas: 8,
  valor_base: 80000, pago_extra: 0, bono_monto: 0, descuento_monto: 0, valor: 80000, ...extra,
});

async function textosDibujados(items) {
  const textos = [];
  const original = PDFDocument.prototype.text;
  const espia = jest.spyOn(PDFDocument.prototype, 'text').mockImplementation(function (texto, ...resto) {
    textos.push(String(texto));
    return original.call(this, texto, ...resto);
  });
  try {
    await new Promise((resolve, reject) => {
      const s = new PassThrough(); s.on('data', () => {}); s.on('end', resolve); s.on('error', reject);
      generarCuentaCobroPdf({
        empresa_id: 1, empresa_nombre: 'Acme', trabajador_nombre: 'Ana', trabajador_apellido: 'Pérez', trabajador_cedula: '1',
        fecha_inicio: '2030-01-01', fecha_fin: '2030-01-15', numero_cuenta: 'CC-1', secuencia: 1, firmado_trabajador: 0,
        items, total_turnos: items.length, total_horas: items.length * 8, valor_total: items.length * 80000,
      }, s).catch(reject);
    });
  } finally { espia.mockRestore(); }
  return textos;
}

test('usa el nombre corto; sin él acorta la dirección larga; una dirección corta queda igual', async () => {
  const textos = await textosDibujados([
    item(1, LARGA, { lugar_alias: 'Feria' }),
    item(2, LARGA),
    item(3, 'Bodega Central'),
  ]);
  const metas = textos.filter((t) => t.startsWith('Auxiliar de montaje'));
  expect(metas).toEqual([
    'Auxiliar de montaje · Feria',
    'Auxiliar de montaje · Corferias, Carrera 37',
    'Auxiliar de montaje · Bodega Central',
  ]);
});
