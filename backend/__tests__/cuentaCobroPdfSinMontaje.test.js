'use strict';

// En la cuenta de cobro, un título largo ocupa varias líneas y la línea de cargo/lugar de abajo se dibujaba
// ENCIMA de su segunda línea (doc.y quedaba al final de la celda de una sola línea). Se comprueba con las
// posiciones reales con que se dibuja cada texto: lo de abajo empieza después de donde termina el título.
const { PassThrough } = require('stream');
const PDFDocument = require('pdfkit');
const { generarCuentaCobroPdf } = require('../utils/cuentaCobroPdf');

const LUGAR_LARGO = 'Corferias, Carrera 37, Quinta Paredes, Teusaquillo, Bogotá, Bogotá Distrito Capital, RAP (Especial) Central, 111321, Colombia';
const TITULO_LARGO = 'Montaje de stands, iluminación y sonido para la gran feria del libro de la ciudad';

const item = (n, descripcion, lugar) => ({
  asignacion_id: n, fecha: `2030-01-0${n}`, descripcion, cargo: 'Auxiliar de montaje', lugar, horas: 8,
  valor_base: 80000, pago_extra: 0, bono_monto: 0, descuento_monto: 0, valor: 80000,
});

/** Genera el PDF y devuelve cada texto dibujado con su y, y cuánto mide el de la descripción (a su ancho). */
async function dibujar(items) {
  const llamadas = [];
  const original = PDFDocument.prototype.text;
  const espia = jest.spyOn(PDFDocument.prototype, 'text').mockImplementation(function (texto, x, y, opciones) {
    if (typeof y === 'number') llamadas.push({ texto: String(texto), x, y, altura: this.heightOfString(String(texto), opciones) });
    return original.call(this, texto, x, y, opciones);
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
  return llamadas;
}

test('un título largo no se monta con la línea de cargo y lugar de abajo', async () => {
  const llamadas = await dibujar([item(1, TITULO_LARGO, LUGAR_LARGO)]);
  const titulo = llamadas.find((l) => l.texto === TITULO_LARGO);
  const meta = llamadas.find((l) => l.texto.startsWith('Auxiliar de montaje'));
  expect(titulo.altura).toBeGreaterThan(20); // ocupa al menos dos líneas: el caso que fallaba
  expect(meta.y).toBeGreaterThanOrEqual(titulo.y + titulo.altura);
});

test('un lugar muy largo ocupa varias líneas y la fila siguiente empieza debajo, sin montarse', async () => {
  const llamadas = await dibujar([item(1, 'Montaje', LUGAR_LARGO), item(2, 'Desmontaje', LUGAR_LARGO)]);
  const metas = llamadas.filter((l) => l.texto.startsWith('Auxiliar de montaje'));
  const segundaFila = llamadas.find((l) => l.texto === 'Desmontaje');
  expect(metas[0].altura).toBeGreaterThan(20);
  expect(segundaFila.y).toBeGreaterThanOrEqual(metas[0].y + metas[0].altura);
});

test('con título corto la fila queda como siempre: cargo y lugar justo debajo del título', async () => {
  const llamadas = await dibujar([item(1, 'Montaje', 'Bodega Central')]);
  const titulo = llamadas.find((l) => l.texto === 'Montaje');
  const meta = llamadas.find((l) => l.texto.startsWith('Auxiliar de montaje'));
  expect(meta.y - titulo.y).toBeLessThan(titulo.altura + 6); // una línea + el pequeño espacio de siempre
});
