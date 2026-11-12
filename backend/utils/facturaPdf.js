'use strict';

const path = require('path');
const PDFDocument = require('pdfkit');
const { piePdfMarca } = require('./marcaPdf');
const { dibujarFirma } = require('./firmaPdf');

const LOGO = path.join(__dirname, '..', 'assets', 'logo-gris.png');
const NARANJA = '#FF5A3C';
const NARANJA_SUAVE = '#FFF1ED';
const GRIS_OSCURO = '#0F172A';
const GRIS_TEXTO = '#334155';
const GRIS_ETIQUETA = '#64748B';
const GRIS_LINEA = '#94A3B8';

const MARGEN = 56;
const ANCHO_UTIL = 483; // A4 (595.28pt) − 2×margen
const COL_IZQ_X = MARGEN;
const COL_IZQ_ANCHO = 215;
const COL_DER_X = 295;
const COL_DER_ANCHO = 244;

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

/** `emisor` de FACTURA_EMISOR_* — mismo shape en los dos sitios que generan la cuenta de cobro. */
function emisorDesdeEnv() {
  return {
    nombre: process.env.FACTURA_EMISOR_NOMBRE,
    documento: process.env.FACTURA_EMISOR_DOCUMENTO,
    email: process.env.FACTURA_EMISOR_EMAIL,
    // Opcional — firma escaneada como data URI. Sin ella se imprime el nombre como firma.
    firmaB64: process.env.FACTURA_EMISOR_FIRMA_B64 || null,
  };
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

/** Etiqueta pequeña en mayúscula gris seguida de un valor — una línea por dato dentro de una columna de ancho fijo. */
function campo(doc, etiqueta, valor, x, ancho) {
  doc.font('Helvetica-Bold').fontSize(8).fillColor(GRIS_ETIQUETA).text(etiqueta.toUpperCase(), x, doc.y, { width: ancho });
  doc.font('Helvetica').fontSize(10).fillColor(GRIS_OSCURO).text(valor || '—', x, doc.y, { width: ancho });
  doc.moveDown(0.4);
}

/**
 * Genera el PDF de la cuenta de cobro (del período ya vigente/pagado) de la suscripción y lo
 * devuelve como Buffer. El emisor (persona natural, no obligada a facturar electrónicamente)
 * sale de variables de entorno FACTURA_EMISOR_* — emisor.firmaB64 es opcional (upgrade path:
 * FACTURA_EMISOR_FIRMA_B64 con una firma escaneada; sin ella se imprime el nombre como firma).
 * `medioPago` (ej. "Wompi") es opcional — se omite la frase si no se conoce el canal real.
 */
function generarFacturaPdf({ numero, fecha, emisor, cliente, concepto, montoCop, medioPago }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: MARGEN });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // ── Encabezado: marca a la izquierda, título + número a la derecha ──
    const topY = doc.y;
    doc.image(LOGO, MARGEN, topY, { width: 30, height: 30 });
    doc.font('Helvetica-Bold').fontSize(17).fillColor(NARANJA)
      .text('ZATURNO', MARGEN + 38, topY + 7, { lineBreak: false });

    doc.font('Helvetica-Bold').fontSize(14).fillColor(GRIS_OSCURO)
      .text('CUENTA DE COBRO', COL_DER_X, topY, { width: COL_DER_ANCHO, align: 'right' });
    doc.font('Helvetica').fontSize(9).fillColor(GRIS_ETIQUETA)
      .text(`N.º ${numero}`, COL_DER_X, doc.y + 2, { width: COL_DER_ANCHO, align: 'right' });
    doc.text(`${fecha} · PAGADA`, COL_DER_X, doc.y, { width: COL_DER_ANCHO, align: 'right' });

    doc.y = Math.max(topY + 34, doc.y) + 10;
    doc.moveTo(MARGEN, doc.y).lineTo(MARGEN + ANCHO_UTIL, doc.y).lineWidth(2).strokeColor(NARANJA).stroke();
    doc.moveDown(1);

    // ── Sobre el servicio ──
    // x explícito en todo lo que sigue: el encabezado dejó doc.x en COL_DER_X (texto
    // alineado a la derecha) y pdfkit no lo resetea solo — sin esto, este párrafo y los
    // de más abajo heredan esa x y terminan corridos hacia la columna derecha.
    doc.font('Helvetica-Bold').fontSize(8).fillColor(GRIS_ETIQUETA).text('SOBRE EL SERVICIO', MARGEN, doc.y, { width: ANCHO_UTIL });
    doc.moveDown(0.2);
    doc.font('Helvetica').fontSize(9).fillColor(GRIS_TEXTO).text(
      'Zaturno es una plataforma de gestión de turnos y nómina para empresas colombianas: ' +
      'asignación de turnos, marcación de ingreso y egreso, y liquidación de nómina con los ' +
      'recargos de ley vigentes (nocturno, dominical/festivo y horas extra).',
      MARGEN, doc.y, { align: 'justify', width: ANCHO_UTIL }
    );
    doc.moveDown(1.2);

    // ── Cobra / Debe, en dos columnas ──
    const filaY = doc.y;
    doc.y = filaY;
    campo(doc, 'Cobra', emisor.nombre, COL_IZQ_X, COL_IZQ_ANCHO);
    campo(doc, 'Documento', emisor.documento, COL_IZQ_X, COL_IZQ_ANCHO);
    campo(doc, 'Correo', emisor.email, COL_IZQ_X, COL_IZQ_ANCHO);
    const yIzq = doc.y;

    doc.y = filaY;
    campo(doc, 'Debe', cliente.nombre, COL_DER_X, COL_DER_ANCHO);
    campo(doc, 'NIT', cliente.nit, COL_DER_X, COL_DER_ANCHO);
    campo(doc, 'Correo', cliente.email, COL_DER_X, COL_DER_ANCHO);
    const yDer = doc.y;

    doc.y = Math.max(yIzq, yDer) + 0.4;

    // ── Concepto ──
    // Mismo motivo: la columna "Debe" dejó doc.x en COL_DER_X.
    doc.font('Helvetica-Bold').fontSize(8).fillColor(GRIS_ETIQUETA).text('CONCEPTO', MARGEN, doc.y, { width: ANCHO_UTIL });
    doc.font('Helvetica').fontSize(10).fillColor(GRIS_OSCURO).text(concepto, MARGEN, doc.y, { width: ANCHO_UTIL });
    doc.moveDown(0.8);

    // ── Valor, resaltado ──
    const cajaY = doc.y;
    const cajaAlto = 48;
    doc.rect(MARGEN, cajaY, ANCHO_UTIL, cajaAlto).fill(NARANJA_SUAVE);
    doc.font('Helvetica-Bold').fontSize(15).fillColor(GRIS_OSCURO)
      .text(`VALOR: ${cop(montoCop)} COP`, MARGEN + 12, cajaY + 9, { width: ANCHO_UTIL - 24 });
    doc.font('Helvetica').fontSize(9).fillColor(GRIS_TEXTO)
      .text(`Son: ${enLetras(montoCop)} PESOS M/CTE.`, MARGEN + 12, cajaY + 30, { width: ANCHO_UTIL - 24 });
    doc.y = cajaY + cajaAlto + 16;

    // ── Aviso legal ──
    const medioTexto = medioPago ? ` a través de ${medioPago}` : '';
    doc.font('Helvetica').fontSize(8).fillColor(GRIS_ETIQUETA).text(
      `Valor recibido${medioTexto}. Persona natural no responsable de IVA y no obligada a expedir ` +
      'factura de venta (Estatuto Tributario, arts. 437 par. 3 y 616-2).',
      MARGEN, doc.y, { align: 'justify', width: ANCHO_UTIL }
    );
    doc.moveDown(1.8);

    // ── Firma ──
    if (emisor.firmaB64) {
      try {
        dibujarFirma(doc, emisor.firmaB64, { width: 160, height: 56 });
      } catch {
        doc.moveDown(2.2);
      }
      doc.moveDown(0.2);
    } else {
      doc.moveDown(2.2);
    }
    doc.moveTo(MARGEN, doc.y).lineTo(MARGEN + 160, doc.y).lineWidth(0.5).strokeColor(GRIS_LINEA).stroke();
    doc.moveDown(0.3);
    doc.font('Helvetica-Bold').fontSize(9).fillColor(GRIS_OSCURO).text(emisor.nombre || '—', MARGEN, doc.y, { width: 200 });
    doc.font('Helvetica').fontSize(8).fillColor(GRIS_ETIQUETA).text(emisor.documento || '', MARGEN, doc.y, { width: 200 });

    piePdfMarca(doc);
    doc.end();
  });
}

module.exports = { generarFacturaPdf, enLetras, emisorDesdeEnv };
