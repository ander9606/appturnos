'use strict';

const PDFDocument = require('pdfkit');
const { piePdfMarca } = require('./marcaPdf');

const cop = (n) => `$ ${Number(n).toLocaleString('es-CO')}`;

/**
 * Genera el PDF de la cuenta de cobro de la suscripción (Zaturno cobrándole a la
 * empresa) y lo devuelve como Buffer. El emisor es persona natural, no obligada
 * a facturar electrónicamente — sale de variables de entorno FACTURA_EMISOR_*.
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

    doc.fontSize(16).font('Helvetica-Bold').text('CUENTA DE COBRO', { align: 'center' });
    doc.moveDown(0.3);
    doc.fontSize(10).font('Helvetica').text(`N.º ${numero}  ·  ${fecha}`, { align: 'center' });
    doc.moveDown(1.5);

    doc.fontSize(11);
    linea('Señores', `${cliente.nombre}${cliente.nit ? ` (NIT ${cliente.nit})` : ''}`);
    linea('Correo', cliente.email);
    doc.moveDown(1);

    doc.font('Helvetica-Bold').text('Debe a');
    linea('Nombre', emisor.nombre);
    linea('Documento', emisor.documento);
    linea('Correo', emisor.email);
    doc.moveDown(1.5);

    doc.font('Helvetica-Bold').text('Por concepto de');
    doc.font('Helvetica').text(concepto);
    doc.moveDown(1);
    doc.font('Helvetica-Bold').fontSize(13).text(`VALOR: ${cop(montoCop)} COP`);
    doc.moveDown(2);

    doc.font('Helvetica').fontSize(9).fillColor('#475569').text(
      'El presente documento se expide como cuenta de cobro por la prestación de un servicio ' +
        'realizado de forma independiente, sin que exista relación laboral entre las partes. ' +
        'Quien cobra es una persona natural no obligada a facturar electrónicamente conforme al ' +
        'artículo 616-2 del Estatuto Tributario y normas concordantes. Pago recibido a través de Wompi.',
      { align: 'justify' }
    );
    piePdfMarca(doc);
    doc.end();
  });
}

module.exports = { generarFacturaPdf };
