'use strict';

const PDFDocument = require('pdfkit');
const { piePdfMarca } = require('./marcaPdf');
const { dibujarFirma } = require('./firmaPdf');
const logger = require('./logger');

/**
 * `empresas.logo_url` guarda, en la misma columna MEDIUMTEXT, una imagen
 * subida como data URI ("data:image/png;base64,...") o una URL externa
 * vieja de cuando el campo solo aceptaba links (ver migración 098). Las
 * URLs externas no se descargan (SSRF: la URL la controla admin_empresa,
 * un rol de confianza baja en un backend multi-tenant) — igual que
 * firmaPdf.js, que maneja la misma columna y nunca hace fetch de red. Las
 * filas viejas con URL externa simplemente no muestran logo, igual que ya
 * pasa en cualquier otro PDF que usa esta columna.
 */
async function obtenerLogoBuffer(logoUrl) {
  if (!logoUrl) return null;
  if (/^data:image\/(png|jpe?g);base64,/.test(logoUrl)) {
    return Buffer.from(logoUrl.replace(/^data:image\/[\w+-]+;base64,/, ''), 'base64');
  }
  return null;
}

/**
 * Genera el PDF de una cuenta de cobro (agregado de turnos de un período) y
 * lo escribe en `stream` (normalmente la respuesta HTTP). `cuenta` debe venir
 * con los datos de empresa, trabajador e `items` ya parseado (ver
 * CuentasCobroModel.obtenerPorId).
 */
async function generarCuentaCobroPdf(cuenta, stream) {
  const logoBuffer = await obtenerLogoBuffer(cuenta.empresa_logo_url);

  const doc = new PDFDocument({ size: 'A4', margin: 56 });
  doc.pipe(stream);

  if (logoBuffer) {
    try {
      const anchoLogo = 120;
      doc.image(logoBuffer, (doc.page.width - anchoLogo) / 2, doc.y, { fit: [anchoLogo, 60] });
      doc.y += 66;
    } catch (err) {
      // Logo corrupto o en un formato que pdfkit no decodifica (solo PNG/JPEG) — se omite.
      logger.warn(`[cuentaCobroPdf] logo de la empresa ${cuenta.empresa_id} no se pudo dibujar: ${err.message}`);
    }
  }

  doc.fontSize(16).font('Helvetica-Bold').text('CUENTA DE COBRO', { align: 'center' });
  doc.moveDown(0.3);
  doc.fontSize(10).font('Helvetica').text(`N.º ${cuenta.numero_cuenta}`, { align: 'center' });
  if (cuenta.secuencia > 1) {
    doc.fontSize(9).font('Helvetica-Oblique')
      .text('Cuenta complementaria: diferencia de valores respecto a cuentas anteriores del período', { align: 'center' });
  }
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

  doc.font('Helvetica-Bold').fontSize(10).text('Datos bancarios para pago:');
  doc.fontSize(10);
  if (cuenta.trabajador_banco) {
    linea('Banco', cuenta.trabajador_banco);
    linea('Tipo de cuenta', cuenta.trabajador_tipo_cuenta);
    linea('N.º de cuenta', cuenta.trabajador_numero_cuenta);
  } else {
    doc.font('Helvetica-Oblique').text('El trabajador no ha registrado datos bancarios.');
  }
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
    doc.moveDown(0.3);

    const meta = [item.cargo, item.lugar].filter(Boolean).join(' · ');
    if (meta) {
      doc.font('Helvetica-Oblique').fontSize(8).fillColor('#475569')
        .text(meta, col.desc, doc.y, { width: 240 });
      doc.font('Helvetica').fontSize(9).fillColor('#000000');
    }

    const extra = Number(item.pago_extra || 0);
    const bono = Number(item.bono_monto || 0);
    const descuento = Number(item.descuento_monto || 0);
    if (extra > 0 || bono > 0 || descuento > 0) {
      const partes = [`Base $ ${Number(item.valor_base).toLocaleString('es-CO')}`];
      if (extra > 0) partes.push(`recargo $ ${extra.toLocaleString('es-CO')}`);
      if (bono > 0) partes.push(`bono $ ${bono.toLocaleString('es-CO')}${item.bono_motivo ? ` (${item.bono_motivo})` : ''}`);
      let texto = partes.join(' + ');
      if (descuento > 0) texto += ` − descuento $ ${descuento.toLocaleString('es-CO')}${item.descuento_motivo ? ` (${item.descuento_motivo})` : ''}`;
      doc.font('Helvetica-Oblique').fontSize(8).fillColor('#B45309')
        .text(texto, col.desc, doc.y, { width: 240 });
      doc.font('Helvetica').fontSize(9).fillColor('#000000');
    }
    doc.moveDown(0.4);
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
      dibujarFirma(doc, cuenta.firma_b64, { width: 180, height: 80 });
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

  piePdfMarca(doc);
  doc.end();
}

module.exports = { generarCuentaCobroPdf, obtenerLogoBuffer };
