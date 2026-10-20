'use strict';

const path = require('path');

const LOGO_GRIS = path.join(__dirname, '..', 'assets', 'logo-gris.png');
const GRIS = '#94A3B8';

/**
 * Pie discreto: logo gris + "Generado por Zaturno" centrados al fondo de la
 * última página. Se llama justo antes de `doc.end()`. Se escribe dentro del
 * margen inferior, así que no provoca una página nueva.
 */
function piePdfMarca(doc) {
  const { width, height, margins } = doc.page;
  const y = height - margins.bottom + 14;
  const ancho = 120;
  const x = (width - ancho) / 2;
  const prevBottom = margins.bottom;
  margins.bottom = 0; // evita el salto de página al escribir en la zona del margen
  doc.save();
  doc.image(LOGO_GRIS, x, y, { width: 14, height: 14 });
  doc.font('Helvetica').fontSize(8).fillColor(GRIS)
    .text('Generado por Zaturno', x + 18, y + 3, { width: ancho - 18, lineBreak: false });
  doc.restore();
  margins.bottom = prevBottom;
}

module.exports = { piePdfMarca };
