'use strict';

const PDFDocument = require('pdfkit');

const cop = (n) => `$ ${Number(n).toLocaleString('es-CO')}`;

/**
 * Genera el PDF del comprobante de pago de la suscripción y lo devuelve como Buffer.
 * El emisor (persona natural) sale de variables de entorno FACTURA_EMISOR_*.
 */
function generarFacturaPdf({ numero, fecha, emisor, cliente, concepto, montoCop }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 56 });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const linea = (etiqueta, valor) =>
      doc.font('Helvetica-Bold').text(`${etiqueta}: `, { continued: true })
        .font('Helvetica').text(valor || '—');

    doc.fontSize(16).font('Helvetica-Bold').text('COMPROBANTE DE PAGO', { align: 'center' });
    doc.moveDown(0.3);
    doc.fontSize(10).font('Helvetica').text(`N.º ${numero}  ·  ${fecha}`, { align: 'center' });
    doc.moveDown(1.5);

    doc.fontSize(11);
    doc.font('Helvetica-Bold').text('Emisor');
    linea('Nombre', emisor.nombre);
    linea('Documento', emisor.documento);
    linea('Correo', emisor.email);
    doc.moveDown(1);

    doc.font('Helvetica-Bold').text('Cliente');
    linea('Razón social', cliente.nombre);
    linea('NIT', cliente.nit);
    linea('Correo', cliente.email);
    doc.moveDown(1.5);

    doc.font('Helvetica-Bold').text('Concepto');
    doc.font('Helvetica').text(concepto);
    doc.moveDown(1);
    doc.font('Helvetica-Bold').fontSize(13).text(`TOTAL PAGADO: ${cop(montoCop)} COP`);
    doc.moveDown(2);

    doc.font('Helvetica').fontSize(9).fillColor('#475569').text(
      'Pago recibido a través de Wompi. Documento emitido por persona natural no responsable de IVA.',
      { align: 'justify' }
    );
    doc.end();
  });
}

module.exports = { generarFacturaPdf };
