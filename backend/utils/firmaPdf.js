'use strict';

/**
 * Dibuja la firma digital (SVG generado por SignaturePad.tsx — paths con
 * comandos M/Q/L, no un PNG/JPEG) en la posición actual del documento.
 *
 * pdfkit solo decodifica PNG/JPEG en doc.image(); por eso toda firma caía
 * siempre al catch de "no legible" — no era un problema de datos truncados
 * (eso ya lo resolvió la migración 101 a MEDIUMTEXT), era que se intentaba
 * leer un SVG como si fuera un raster. doc.path() sí entiende el mismo
 * mini-lenguaje de paths que usa SVG, así que se extraen los <path d="...">
 * y se dibujan como vectores nativos, escalados al cuadro pedido.
 */
function dibujarFirma(doc, firmaB64, { width = 180, height = 80 } = {}) {
  const svg = Buffer.from(
    String(firmaB64).replace(/^data:image\/[\w+-]+;base64,/, ''),
    'base64'
  ).toString('utf8');

  const anchoOriginal = Number(svg.match(/width="([\d.]+)"/)?.[1]) || width;
  const altoOriginal = Number(svg.match(/height="([\d.]+)"/)?.[1]) || height;
  const paths = [...svg.matchAll(/<path d="([^"]+)"/g)].map((m) => m[1]);
  if (paths.length === 0) throw new Error('SVG de firma sin paths');

  const escala = Math.min(width / anchoOriginal, height / altoOriginal, 1);
  const x = doc.x;
  const y = doc.y;
  doc.save();
  doc.translate(x, y).scale(escala);
  for (const d of paths) {
    doc.path(d).lineWidth(2.5).stroke('#0F172A');
  }
  doc.restore();
  doc.y = y + altoOriginal * escala;
}

module.exports = { dibujarFirma };
