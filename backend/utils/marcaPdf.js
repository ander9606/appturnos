'use strict';

const NARANJA = '#FF5A3C';
const NARANJA_700 = '#C32D14';

// ponytail: wordmark de texto en vez de logo PNG — upgrade path: doc.image(logo) cuando haya un asset en backend/assets
/** Franja naranja superior + wordmark "Zaturno". Se llama justo tras crear el doc. */
function bandaMarca(doc) {
  doc.save().rect(0, 0, doc.page.width, 8).fill(NARANJA).restore();
  doc.save().font('Helvetica-Bold').fontSize(10).fillColor(NARANJA_700)
    .text('Zaturno', 56, 22, { width: doc.page.width - 112, align: 'right', lineBreak: false })
    .restore();
  doc.fillColor('#000000').font('Helvetica');
  doc.y = 56;
}

module.exports = { bandaMarca, NARANJA, NARANJA_700 };
