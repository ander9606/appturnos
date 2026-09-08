'use strict';

const PDFDocument = require('pdfkit');

/**
 * Genera el PDF de una cuenta de cobro (agregado de turnos de un período) y
 * lo escribe en `stream` (normalmente la respuesta HTTP). `cuenta` debe venir
 * con los datos de empresa, trabajador e `items` ya parseado (ver
 * CuentasCobroModel.obtenerPorId).
 */
function generarCuentaCobroPdf(cuenta, stream) {
  const doc = new PDFDocument({ size: 'A4', margin: 56 });
  doc.pipe(stream);

  doc.fontSize(16).font('Helvetica-Bold').text('CUENTA DE COBRO', { align: 'center' });
  doc.moveDown(0.3);
  doc.fontSize(10).font('Helvetica').text(`N.º ${cuenta.numero_cuenta}`, { align: 'center' });
  doc.moveDown(1.2);

  const linea = (etiqueta, valor) => {
    doc
      .font('Helvetica-Bold')
      .text(`${etiqueta}: `, { continued: true })
      .font('Helvetica')
      .text(valor != null && valor !== '' ? String(valor) : '—');
  };

  doc.fontSize(11);
  linea('Señores', `${cuenta.empresa_nombre}${cuenta.empresa_nit ? ` (NIT ${cuenta.empresa_nit})` : ''}`);
  linea('Debe a', `${cuenta.trabajador_nombre} ${cuenta.trabajador_apellido}`);
  linea('Cédula', cuenta.trabajador_cedula);
  linea('Período', `${cuenta.fecha_inicio} a ${cuenta.fecha_fin}`);
  doc.moveDown(1);

  doc
    .font('Helvetica-Bold')
    .fontSize(10)
    .text('Por concepto de la prestación de servicios detallada a continuación:');
  doc.moveDown(0.6);

  // Tabla manual (pdfkit no trae helper de tablas) — columnas por posición x fija.
  const col = { fecha: 56, desc: 130, horas: 380, valor: 440 };
  const dibujarEncabezado = () => {
    const y = doc.y;
    doc.font('Helvetica-Bold').fontSize(9);
    doc.text('Fecha', col.fecha, y, { width: 70 });
    doc.text('Descripción', col.desc, y, { width: 240 });
    doc.text('Horas', col.horas, y, { width: 50, align: 'right' });
    doc.text('Valor', col.valor, y, { width: 100, align: 'right' });
    doc.moveDown(0.3);
    doc.moveTo(56, doc.y).lineTo(540, doc.y).strokeColor('#94A3B8').stroke();
    doc.moveDown(0.3);
  };
  dibujarEncabezado();

  doc.font('Helvetica').fontSize(9);
  for (const item of cuenta.items) {
    if (doc.y > 700) {
      doc.addPage();
      dibujarEncabezado();
      doc.font('Helvetica').fontSize(9);
    }
    const y = doc.y;
    doc.text(item.fecha, col.fecha, y, { width: 70 });
    doc.text(item.descripcion || '—', col.desc, y, { width: 240 });
    doc.text(Number(item.horas).toFixed(1), col.horas, y, { width: 50, align: 'right' });
    doc.text(`$ ${Number(item.valor).toLocaleString('es-CO')}`, col.valor, y, { width: 100, align: 'right' });
    doc.moveDown(0.5);
  }

  doc.moveTo(56, doc.y).lineTo(540, doc.y).strokeColor('#94A3B8').stroke();
  doc.moveDown(0.4);
  doc.font('Helvetica-Bold').fontSize(11);
  doc.text(`Total turnos: ${cuenta.total_turnos}    Total horas: ${Number(cuenta.total_horas).toFixed(1)}`);
  doc.text(`VALOR TOTAL: $ ${Number(cuenta.valor_total).toLocaleString('es-CO')}`);
  doc.moveDown(1.5);

  doc
    .font('Helvetica')
    .fontSize(10)
    .text(
      'El presente documento se expide como cuenta de cobro por servicios prestados de forma ' +
        'independiente y autónoma, sin que exista relación laboral, subordinación ni prestaciones ' +
        'sociales entre las partes, de conformidad con la legislación colombiana aplicable a ' +
        'contratos de prestación de servicios. El prestador del servicio declara estar afiliado y ' +
        'al día con sus aportes al Sistema General de Seguridad Social (salud y pensión).',
      { align: 'justify' }
    );
  doc.moveDown(2);

  if (cuenta.firmado_trabajador && cuenta.firma_b64) {
    try {
      const base64 = String(cuenta.firma_b64).replace(/^data:image\/\w+;base64,/, '');
      doc.image(Buffer.from(base64, 'base64'), { fit: [180, 80] });
    } catch {
      doc.font('Helvetica-Oblique').fontSize(9).text('(firma digital no legible)');
    }
    doc
      .font('Helvetica')
      .fontSize(9)
      .text(`Firmado digitalmente el ${cuenta.firmado_at}`);
  } else {
    doc.font('Helvetica-Oblique').fontSize(10).text('Pendiente de firma del prestador del servicio.');
  }

  doc.moveDown(0.4);
  doc.font('Helvetica-Bold').fontSize(10).text('_______________________________');
  doc
    .font('Helvetica')
    .fontSize(10)
    .text(`${cuenta.trabajador_nombre} ${cuenta.trabajador_apellido}`);
  doc.text(`C.C. ${cuenta.trabajador_cedula}`);

  doc.end();
}

module.exports = { generarCuentaCobroPdf };
