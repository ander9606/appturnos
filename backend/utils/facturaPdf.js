'use strict';

const PDFDocument = require('pdfkit');
const { piePdfMarca } = require('./marcaPdf');

const cop = (n) => `$ ${Number(n).toLocaleString('es-CO')}`;

const UNIDADES = ['', 'UN', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE', 'DIEZ', 'ONCE', 'DOCE',
  'TRECE', 'CATORCE', 'QUINCE', 'DIECISÉIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE', 'VEINTE', 'VEINTIÚN', 'VEINTIDÓS',
  'VEINTITRÉS', 'VEINTICUATRO', 'VEINTICINCO', 'VEINTISÉIS', 'VEINTISIETE', 'VEINTIOCHO', 'VEINTINUEVE'];
const DECENAS = ['', '', '', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
const CENTENAS = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS',
  'OCHOCIENTOS', 'NOVECIENTOS'];

function menosDeMil(n) {
  if (n === 100) return 'CIEN';
  const resto = n % 100;
  const parte = resto < 30 ? UNIDADES[resto]
    : `${DECENAS[Math.floor(resto / 10)]}${resto % 10 ? ` Y ${UNIDADES[resto % 10]}` : ''}`;
  return [CENTENAS[Math.floor(n / 100)], parte].filter(Boolean).join(' ');
}

/** Entero menor a 1.000 millones en letras ("UN MILLÓN SETECIENTOS MIL"). */
function enLetras(n) {
  if (n === 0) return 'CERO';
  const millones = Math.floor(n / 1e6), miles = Math.floor((n % 1e6) / 1000), resto = n % 1000;
  return [
    millones && (millones === 1 ? 'UN MILLÓN' : `${menosDeMil(millones)} MILLONES`),
    miles && (miles === 1 ? 'MIL' : `${menosDeMil(miles)} MIL`),
    resto && menosDeMil(resto),
  ].filter(Boolean).join(' ');
}

/**
 * Genera el PDF de la cuenta de cobro (ya pagada) de la suscripción y lo devuelve como Buffer.
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

    doc.fontSize(16).font('Helvetica-Bold').text('CUENTA DE COBRO', { align: 'center' });
    doc.moveDown(0.3);
    doc.fontSize(10).font('Helvetica').text(`N.º ${numero}  ·  ${fecha}  ·  PAGADA`, { align: 'center' });
    doc.moveDown(1.5);

    doc.fontSize(11);
    doc.font('Helvetica-Bold').text('Cobra (emisor)');
    linea('Nombre', emisor.nombre);
    linea('Documento', emisor.documento);
    linea('Correo', emisor.email);
    doc.moveDown(1);

    doc.font('Helvetica-Bold').text('Debe (cliente)');
    linea('Razón social', cliente.nombre);
    linea('NIT', cliente.nit);
    linea('Correo', cliente.email);
    doc.moveDown(1.5);

    doc.font('Helvetica-Bold').text('Concepto');
    doc.font('Helvetica').text(concepto);
    doc.moveDown(1);
    doc.font('Helvetica-Bold').fontSize(13).text(`VALOR: ${cop(montoCop)} COP`);
    doc.font('Helvetica').fontSize(10).text(`Son: ${enLetras(montoCop)} PESOS M/CTE.`);
    doc.moveDown(2);

    doc.font('Helvetica').fontSize(9).fillColor('#475569').text(
      'Valor recibido a través de Wompi. Persona natural no responsable de IVA y no obligada a expedir factura de venta ' +
      '(Estatuto Tributario, arts. 437 par. 3 y 616-2).',
      { align: 'justify' }
    );
    piePdfMarca(doc);
    doc.end();
  });
}

module.exports = { generarFacturaPdf, enLetras };
