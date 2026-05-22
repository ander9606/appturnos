'use strict';

const PDFDocument = require('pdfkit');

/**
 * Genera el PDF de un contrato diario y lo escribe en `stream`
 * (normalmente la respuesta HTTP). El contrato debe venir con los datos
 * de empresa, trabajador y oferta (ver ContratosModel.obtenerPorId).
 */
function generarContratoPdf(contrato, stream) {
  const doc = new PDFDocument({ size: 'A4', margin: 56 });
  doc.pipe(stream);

  doc
    .fontSize(16)
    .font('Helvetica-Bold')
    .text('CONTRATO DE PRESTACIÓN DE SERVICIOS POR DÍA', { align: 'center' });
  doc.moveDown(0.4);
  doc.fontSize(10).font('Helvetica').text(`N.º ${contrato.numero_contrato}`, {
    align: 'center',
  });
  doc.moveDown(1.5);

  const linea = (etiqueta, valor) => {
    doc
      .font('Helvetica-Bold')
      .text(`${etiqueta}: `, { continued: true })
      .font('Helvetica')
      .text(valor != null && valor !== '' ? String(valor) : '—');
  };

  doc.fontSize(11);
  linea(
    'Empresa',
    `${contrato.empresa_nombre}${contrato.empresa_nit ? ` (NIT ${contrato.empresa_nit})` : ''}`
  );
  linea('Trabajador', `${contrato.trabajador_nombre} ${contrato.trabajador_apellido}`);
  linea('Cédula', contrato.trabajador_cedula);
  linea('Fecha del servicio', contrato.fecha);
  linea('Labor', contrato.descripcion_labor || contrato.oferta_titulo);
  linea('Lugar', contrato.lugar);
  linea(
    'Horario',
    `${contrato.hora_inicio || '—'}${
      contrato.hora_fin_estimada ? ` a ${contrato.hora_fin_estimada}` : ''
    }`
  );
  linea('Valor del día', `$ ${Number(contrato.valor_dia).toLocaleString('es-CO')}`);
  doc.moveDown(1);

  doc
    .font('Helvetica')
    .fontSize(10)
    .text(
      'El trabajador prestará sus servicios para la labor descrita en la fecha indicada, ' +
        'reconociéndosele el valor del día aquí pactado. La firma digital al pie de este ' +
        'documento constituye constancia de su aceptación.',
      { align: 'justify' }
    );
  doc.moveDown(2.5);

  if (contrato.firmado_trabajador && contrato.firma_b64) {
    try {
      const base64 = String(contrato.firma_b64).replace(/^data:image\/\w+;base64,/, '');
      doc.image(Buffer.from(base64, 'base64'), { fit: [180, 80] });
    } catch {
      doc.font('Helvetica-Oblique').fontSize(9).text('(firma digital no legible)');
    }
    doc
      .font('Helvetica')
      .fontSize(9)
      .text(`Firmado digitalmente el ${contrato.firmado_at}`);
  } else {
    doc.font('Helvetica-Oblique').fontSize(10).text('Pendiente de firma del trabajador.');
  }

  doc.moveDown(0.4);
  doc.font('Helvetica-Bold').fontSize(10).text('_______________________________');
  doc
    .font('Helvetica')
    .fontSize(10)
    .text(`${contrato.trabajador_nombre} ${contrato.trabajador_apellido}`);

  doc.end();
}

module.exports = { generarContratoPdf };
