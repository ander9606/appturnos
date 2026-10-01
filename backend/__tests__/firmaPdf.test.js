'use strict';

// SignaturePad.tsx exporta la firma como SVG (paths M/Q/L), no como PNG/JPEG.
// pdfkit solo decodifica raster en doc.image() — por eso toda firma caía al
// catch de "no legible" en contratoPdf.js/cuentaCobroPdf.js. dibujarFirma()
// dibuja los <path> como vectores nativos de pdfkit en vez de intentar
// leerlos como imagen.
const { dibujarFirma } = require('../utils/firmaPdf');

function svgBase64(svg) {
  return Buffer.from(svg, 'utf8').toString('base64');
}

function crearDocMock(x = 50, y = 100) {
  const pathsDibujados = [];
  const doc = {
    x, y,
    save: jest.fn(() => doc),
    translate: jest.fn(() => doc),
    scale: jest.fn(() => doc),
    path: jest.fn((d) => { pathsDibujados.push(d); return doc; }),
    lineWidth: jest.fn(() => doc),
    stroke: jest.fn(() => doc),
    restore: jest.fn(() => doc),
  };
  return { doc, pathsDibujados };
}

describe('dibujarFirma', () => {
  test('dibuja cada <path> del SVG escalado al cuadro pedido', () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="180" viewBox="0 0 300 180">' +
      '<path d="M 1.0 1.0 L 2.0 2.0" stroke="#0F172A"/>' +
      '<path d="M 3.0 3.0 Q 4.0 4.0 5.0 5.0" stroke="#0F172A"/></svg>';
    const { doc, pathsDibujados } = crearDocMock(50, 100);

    dibujarFirma(doc, svgBase64(svg), { width: 180, height: 80 });

    expect(pathsDibujados).toEqual(['M 1.0 1.0 L 2.0 2.0', 'M 3.0 3.0 Q 4.0 4.0 5.0 5.0']);
    expect(doc.translate).toHaveBeenCalledWith(50, 100);
    // min(180/300, 80/180) = min(0.6, 0.444..) = 0.444..
    const escala = Math.min(180 / 300, 80 / 180);
    expect(doc.scale).toHaveBeenCalledWith(escala);
    expect(doc.y).toBeCloseTo(100 + 180 * escala);
  });

  test('acepta el prefijo data:image/...;base64, igual que el doc.image() anterior', () => {
    const svg = '<svg width="100" height="50"><path d="M 0.0 0.0 L 1.0 1.0"/></svg>';
    const { doc, pathsDibujados } = crearDocMock();

    dibujarFirma(doc, `data:image/svg+xml;base64,${svgBase64(svg)}`, { width: 100, height: 50 });

    expect(pathsDibujados).toEqual(['M 0.0 0.0 L 1.0 1.0']);
  });

  test('nunca escala hacia arriba una firma pequeña (escala tope 1)', () => {
    const svg = '<svg width="20" height="10"><path d="M 0.0 0.0 L 1.0 1.0"/></svg>';
    const { doc } = crearDocMock();

    dibujarFirma(doc, svgBase64(svg), { width: 180, height: 80 });

    expect(doc.scale).toHaveBeenCalledWith(1);
  });

  test('SVG sin paths lanza, para que el llamador caiga a "firma digital no legible"', () => {
    const svg = '<svg width="100" height="50"></svg>';
    const { doc } = crearDocMock();

    expect(() => dibujarFirma(doc, svgBase64(svg))).toThrow();
  });
});
