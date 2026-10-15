'use strict';

/**
 * Dibuja una firma digital en la posición actual del documento. Admite dos
 * formatos (misma columna MEDIUMTEXT en ambos casos):
 *  - SVG de trazos sin prefijo (SignaturePad.tsx en mobile, como
 *    trabajadores.firma_guardada): paths con comandos M/Q/L. pdfkit no
 *    decodifica SVG en doc.image(), así que se extraen los <path d="...">
 *    y se dibujan como vectores nativos con doc.path().
 *  - Imagen subida como data URI (uploader web, como empresas.logo_url):
 *    PNG/JPEG en base64 con el prefijo "data:image/...;base64,", que
 *    doc.image() sí decodifica directamente.
 */
function dibujarFirma(doc, firmaB64, { width = 180, height = 80 } = {}) {
  const texto = String(firmaB64);
  const x = doc.x;
  const y = doc.y;

  if (/^data:image\/(png|jpe?g);base64,/.test(texto)) {
    const buffer = Buffer.from(texto.replace(/^data:image\/[\w+-]+;base64,/, ''), 'base64');
    doc.image(buffer, x, y, { fit: [width, height] });
    doc.y = y + height;
    return;
  }

  const svg = Buffer.from(
    texto.replace(/^data:image\/[\w+-]+;base64,/, ''),
    'base64'
  ).toString('utf8');

  const anchoOriginal = Number(svg.match(/width="([\d.]+)"/)?.[1]) || width;
  const altoOriginal = Number(svg.match(/height="([\d.]+)"/)?.[1]) || height;
  const paths = [...svg.matchAll(/<path d="([^"]+)"/g)].map((m) => m[1]);
  if (paths.length === 0) throw new Error('Firma sin paths ni imagen reconocible');

  const escala = Math.min(width / anchoOriginal, height / altoOriginal, 1);
  doc.save();
  doc.translate(x, y).scale(escala);
  for (const d of paths) {
    doc.path(d).lineWidth(2.5).stroke('#0F172A');
  }
  doc.restore();
  doc.y = y + altoOriginal * escala;
}

module.exports = { dibujarFirma };
