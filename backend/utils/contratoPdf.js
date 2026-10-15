'use strict';

const PDFDocument = require('pdfkit');
const { dibujarFirma } = require('./firmaPdf');

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

function fmtFechaLegal(iso) {
  if (!iso) return '—';
  const [y, m, d] = String(iso).slice(0, 10).split('-');
  return `${parseInt(d, 10)} de ${MESES[parseInt(m, 10) - 1]} de ${y}`;
}

function fmtCOP(n) {
  return `$ ${Number(n ?? 0).toLocaleString('es-CO')}`;
}

function fmtHora(t) {
  return t ? String(t).slice(0, 5) : '—';
}

/**
 * Filas de la tabla "Datos del turno": lo concreto (labor, lugar, fecha,
 * horario, valor, bono/descuentos) se lee una sola vez acá en vez de
 * quedar repetido y disperso dentro de la prosa de las cláusulas — las
 * cláusulas PRIMERA/TERCERA/CUARTA remiten a esta tabla en vez de repetir
 * cada cifra.
 */
function construirFilasTurno(contrato) {
  const filas = [['Labor', contrato.descripcion_labor || contrato.oferta_titulo || '—']];
  if (contrato.lugar) filas.push(['Lugar', contrato.lugar]);
  filas.push(['Fecha', fmtFechaLegal(contrato.fecha)]);
  filas.push(['Horario', `${fmtHora(contrato.hora_inicio)} - ${fmtHora(contrato.hora_fin_estimada)}`]);
  filas.push(['Valor del día', fmtCOP(contrato.valor_dia)]);
  if (Number(contrato.bono_monto) > 0) {
    filas.push(['Bono', `${fmtCOP(contrato.bono_monto)}${contrato.bono_motivo ? ` — ${contrato.bono_motivo}` : ''}`]);
  }
  for (const d of contrato.descuentos ?? []) {
    filas.push(['Descuento', `-${fmtCOP(d.monto)} — ${d.motivo}`]);
  }
  return filas;
}

/** Tabla de dos columnas (label/valor) con regla horizontal por fila — pdfkit no trae tablas, se dibuja a mano. */
function dibujarTabla(doc, filas) {
  const xInicio = doc.page.margins.left;
  const anchoTotal = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const anchoLabel = 110;
  const anchoValor = anchoTotal - anchoLabel;
  const padY = 6;
  const limiteInferior = doc.page.height - doc.page.margins.bottom;

  doc.moveTo(xInicio, doc.y).lineTo(xInicio + anchoTotal, doc.y).strokeColor('#CBD5E1').lineWidth(0.5).stroke();

  for (const [label, valor] of filas) {
    const alturaValor = doc.font('Helvetica').fontSize(10).heightOfString(valor, { width: anchoValor - 8 });
    const altura = Math.max(alturaValor, 12) + padY * 2;

    if (doc.y + altura > limiteInferior) doc.addPage();
    const yFila = doc.y;

    doc.font('Helvetica-Bold').fontSize(9.5).text(label, xInicio, yFila + padY, { width: anchoLabel - 8 });
    doc.font('Helvetica').fontSize(10).text(valor, xInicio + anchoLabel, yFila + padY, { width: anchoValor - 8 });

    doc.moveTo(xInicio, yFila + altura).lineTo(xInicio + anchoTotal, yFila + altura)
      .strokeColor('#E2E8F0').lineWidth(0.5).stroke();

    doc.x = xInicio;
    doc.y = yFila + altura;
  }
}

/**
 * Preámbulo (identifica a las partes) y cláusulas del contrato civil de
 * prestación de servicios por día. representante_* y trabajador_direccion
 * son datos opcionales (perfil aún sin completar en empresas/trabajadores
 * creados antes de esta migración) — el texto se degrada a una fórmula
 * genérica en vez de imprimir "null"/"—".
 */
function construirClausulas(contrato) {
  const nombreContratista = `${contrato.trabajador_nombre} ${contrato.trabajador_apellido}`;
  const docContratista = `${contrato.trabajador_tipo_documento || 'C.C.'} ${contrato.trabajador_cedula || '—'}`;

  const representacion = contrato.empresa_representante_nombre
    ? `, representada legalmente por ${contrato.empresa_representante_nombre}` +
      (contrato.empresa_representante_cedula ? ` (C.C. ${contrato.empresa_representante_cedula})` : '')
    : '';
  const domicilioEmpresa = contrato.empresa_direccion
    ? ` con domicilio en ${contrato.empresa_direccion}${contrato.empresa_ciudad ? `, ${contrato.empresa_ciudad}` : ''}`
    : contrato.empresa_ciudad ? ` con domicilio en ${contrato.empresa_ciudad}` : '';
  const domicilioContratista = contrato.trabajador_direccion ? ` domiciliado(a) en ${contrato.trabajador_direccion}` : '';

  const preambulo =
    `Entre ${contrato.empresa_nombre}${contrato.empresa_nit ? `, NIT ${contrato.empresa_nit}` : ''}${domicilioEmpresa}${representacion} ` +
    `(en adelante EL CONTRATANTE), y ${nombreContratista}, identificado(a) con ${docContratista}${domicilioContratista} ` +
    `(en adelante EL CONTRATISTA), se celebra el presente contrato civil de prestación de servicios, que se regula ` +
    `por lo estipulado en las siguientes cláusulas y, en lo no previsto en ellas, por la ley:`;

  const seguridadSocial =
    `EL CONTRATISTA declara encontrarse afiliado(a), como trabajador(a) independiente, al Sistema de Seguridad ` +
    `Social Integral en Salud${contrato.trabajador_eps ? ` (EPS ${contrato.trabajador_eps})` : ''} y Pensión` +
    `${contrato.trabajador_afp ? ` (AFP ${contrato.trabajador_afp})` : ''}, así como al Sistema General de Riesgos ` +
    `Laborales, de conformidad con el Decreto 1072 de 2015 y demás normas que lo modifiquen o reglamenten, y asume ` +
    `por su cuenta los aportes correspondientes.`;

  const clausulas = [
    ['PRIMERA — OBJETO',
      `EL CONTRATISTA se compromete a prestar sus servicios conforme a la labor y el lugar indicados en la tabla ` +
      `de datos del turno anterior, obligación que ejecutará bajo su entera autonomía técnica, administrativa y ` +
      `financiera, con sus propios medios y sin subordinación jurídica de carácter laboral.`],
    ['SEGUNDA — OBLIGACIONES DEL CONTRATISTA',
      `Cumplir oportuna y diligentemente la labor encomendada; mantener vigente su afiliación a salud, pensión y ` +
      `riesgos laborales; responder por los daños que, por su culpa, cause a terceros o a EL CONTRATANTE en ` +
      `desarrollo del objeto contratado; y guardar reserva sobre la información de EL CONTRATANTE que conozca con ` +
      `ocasión de este contrato.`],
    ['TERCERA — HONORARIOS',
      `EL CONTRATANTE pagará a EL CONTRATISTA el valor del día indicado en la tabla de datos del turno, más los ` +
      `bonos y menos los descuentos allí señalados, una vez completada la labor y firmado el presente contrato. ` +
      `Ese valor es la única e íntegra contraprestación a la que tiene derecho EL CONTRATISTA e incluye los gastos ` +
      `directos e indirectos en que incurra para ejecutar el objeto contratado.`],
    ['CUARTA — DURACIÓN',
      `El presente contrato rige por un (1) día, conforme a la fecha y el horario indicados en la tabla de datos ` +
      `del turno. Cualquiera de las partes puede darlo por terminado antes de su inicio, avisando a la otra, sin ` +
      `que ello genere multa o indemnización a su cargo.`],
    ['QUINTA — NATURALEZA DEL VÍNCULO',
      `El vínculo que se deriva de este contrato es de naturaleza civil. En consecuencia, no genera relación ` +
      `laboral, prestaciones sociales ni subordinación jurídica entre las partes, dado que EL CONTRATISTA actúa ` +
      `con plena autonomía técnica, administrativa y financiera en el desarrollo del objeto contratado.`],
    ['SEXTA — SEGURIDAD SOCIAL', seguridadSocial],
    ['SÉPTIMA — CONFIDENCIALIDAD',
      `EL CONTRATISTA se obliga a guardar reserva sobre la información técnica, comercial o de cualquier otra ` +
      `índole de EL CONTRATANTE que conozca directa o indirectamente con ocasión de la ejecución de este contrato, ` +
      `y a no divulgarla a terceros durante su vigencia ni después de terminado.`],
    ['OCTAVA — TERMINACIÓN',
      `Este contrato termina: por mutuo acuerdo; por vencimiento del día pactado; por incumplimiento de alguna de ` +
      `las partes, desde que se comunique a la otra; o de forma unilateral, por cualquiera de las partes, ` +
      `mediante aviso previo, sin que ello genere indemnización de perjuicios.`],
    ['NOVENA — INDEMNIDAD',
      `EL CONTRATISTA mantendrá indemne a EL CONTRATANTE frente a cualquier reclamación, demanda o perjuicio que ` +
      `se derive de sus actos u omisiones, o de las personas que vincule para ejecutar el objeto contratado, en ` +
      `materia civil, laboral o de seguridad social.`],
    ['DÉCIMA — NOTIFICACIONES',
      `Para efectos de este contrato, las comunicaciones entre las partes se dirigirán a las direcciones indicadas ` +
      `al inicio de este documento. Cualquier cambio de dirección debe informarse por escrito a la otra parte.`],
  ];

  return { preambulo, clausulas };
}

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
    .text('CONTRATO CIVIL DE PRESTACIÓN DE SERVICIOS POR DÍA', { align: 'center' });
  doc.moveDown(0.4);
  doc.fontSize(10).font('Helvetica').text(`N.º ${contrato.numero_contrato}`, { align: 'center' });
  doc.moveDown(1.5);

  const { preambulo, clausulas } = construirClausulas(contrato);

  doc.fontSize(10).font('Helvetica').text(preambulo, { align: 'justify' });
  doc.moveDown(1);

  doc.font('Helvetica-Bold').fontSize(10.5).text('DATOS DEL TURNO');
  doc.moveDown(0.3);
  dibujarTabla(doc, construirFilasTurno(contrato));
  doc.moveDown(1);

  for (const [titulo, cuerpo] of clausulas) {
    doc.font('Helvetica-Bold').fontSize(10.5).text(titulo);
    doc.font('Helvetica').fontSize(10).text(cuerpo, { align: 'justify' });
    doc.moveDown(0.8);
  }

  doc.moveDown(0.5);
  doc.font('Helvetica-Bold').fontSize(10.5).text('FIRMAS');
  doc.moveDown(0.3);

  // EL CONTRATANTE — firma del representante legal, guardada una sola vez
  // en la empresa (empresas.firma_representante_b64) y estampada en todos
  // sus contratos, en vez de pedirle al admin que firme uno por uno.
  if (contrato.empresa_firma_representante_b64) {
    try {
      dibujarFirma(doc, contrato.empresa_firma_representante_b64, { width: 180, height: 70 });
    } catch {
      doc.font('Helvetica-Oblique').fontSize(9).text('(firma digital no legible)');
    }
  } else {
    doc.font('Helvetica-Oblique').fontSize(10).text('Pendiente de firma del representante legal.');
  }
  doc.moveDown(0.4);
  doc.font('Helvetica-Bold').fontSize(10).text('_______________________________');
  doc
    .font('Helvetica')
    .fontSize(10)
    .text(contrato.empresa_representante_nombre || contrato.empresa_nombre);
  doc.font('Helvetica-Oblique').fontSize(8.5).text('Representante legal — EL CONTRATANTE');

  doc.moveDown(1);

  // EL CONTRATISTA — firma del trabajador, por contrato (ver contratos.service.js firmar()).
  if (contrato.firmado_trabajador && contrato.firma_b64) {
    try {
      dibujarFirma(doc, contrato.firma_b64, { width: 180, height: 80 });
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
  doc.font('Helvetica-Oblique').fontSize(8.5).text('EL CONTRATISTA');

  doc.end();
}

module.exports = { generarContratoPdf, construirFilasTurno };
