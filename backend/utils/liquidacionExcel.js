'use strict';

const ExcelJS = require('exceljs');

const AVISO_SIN_RECARGOS =
  'Sin recargos automáticos: las horas de noche y festivo cuentan como normales hasta 42 h a la semana; después, extra diurna.';

/**
 * Columnas del resumen por trabajador. Sin recargos automáticos no hay horas
 * nocturnas, festivas ni extra nocturna como concepto aparte, así que se omiten.
 * `total` (opcional) devuelve el valor de la fila TOTAL para esa columna.
 */
function columnasResumen(recargosAutomaticos) {
  return [
    { header: 'Cédula', width: 16, valor: (l) => l.cedula || '' },
    { header: 'Trabajador', width: 30, valor: (l) => `${l.nombre} ${l.apellido}` },
    { header: 'Días', width: 8, valor: (l) => l.dias_registrados },
    { header: 'H. ordinarias', width: 14, valor: (l) => l.horas_ordinarias },
    { header: 'H. extra diurna', width: 16, valor: (l) => l.horas_extra_diurnas },
    ...(recargosAutomaticos ? [
      { header: 'H. extra nocturna', width: 18, valor: (l) => l.horas_extra_nocturnas },
      { header: 'H. nocturnas', width: 14, valor: (l) => l.horas_nocturnas },
      { header: 'H. festivo', width: 12, valor: (l) => l.horas_festivo },
    ] : []),
    { header: 'Valor hora', width: 14, valor: (l) => l.valor_hora },
    { header: 'Total bruto', width: 16, valor: (l) => l.total, total: (t) => t.total_general },
    { header: 'Descuento salud', width: 14, valor: (l) => l.descuento_salud },
    { header: 'Descuento pensión', width: 14, valor: (l) => l.descuento_pension },
    { header: 'Auxilio transporte', width: 18, valor: (l) => l.subsidio_transporte },
    { header: 'Total neto', width: 16, valor: (l) => l.neto, total: (t) => t.total_neto_general },
  ];
}

/**
 * Genera el libro Excel de una liquidación y devuelve su contenido como Buffer.
 * @param {object} liquidacion  Salida de LiquidacionService.generar. Si trae
 *   `recargos_automaticos: false`, el resumen se adapta a una empresa sin recargos.
 * @param {object[]} [marcajes]  Salida de LiquidacionService.marcajesConUbicacion — si
 *   se pasa, agrega una segunda hoja con el detalle diario de entrada/salida y ubicación.
 * @returns {Promise<Buffer>}
 */
async function generarLiquidacionExcel(liquidacion, marcajes) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'App Turnos';
  const ws = wb.addWorksheet('Liquidación');

  const recargosAutomaticos = liquidacion.recargos_automaticos !== false;
  const columnas = columnasResumen(recargosAutomaticos);
  const ultima = ws.getColumn(columnas.length).letter;

  const { periodo } = liquidacion;
  ws.mergeCells(`A1:${ultima}1`);
  ws.getCell('A1').value =
    `Liquidación período ${periodo.fecha_inicio} a ${periodo.fecha_fin} (${periodo.estado})`;
  ws.getCell('A1').font = { bold: true, size: 13 };

  if (!recargosAutomaticos) {
    ws.mergeCells(`A2:${ultima}2`);
    ws.getCell('A2').value = AVISO_SIN_RECARGOS;
    ws.getCell('A2').font = { italic: true, size: 10 };
  }
  ws.addRow([]);

  ws.columns = columnas.map((c) => ({ key: c.header, width: c.width }));

  const cabecera = ws.addRow(columnas.map((c) => c.header));
  cabecera.font = { bold: true };

  for (const l of liquidacion.lineas) {
    ws.addRow(columnas.map((c) => c.valor(l)));
  }

  const filaTotal = ws.addRow(columnas.map((c) => (c.total ? c.total(liquidacion.totales) : '')));
  filaTotal.getCell(2).value = 'TOTAL';
  filaTotal.font = { bold: true };

  if (marcajes?.length) agregarHojaMarcajes(wb, marcajes);

  return wb.xlsx.writeBuffer();
}

/** Segunda hoja: detalle diario de entrada/salida con la ubicación resuelta. */
function agregarHojaMarcajes(wb, marcajes) {
  const ws = wb.addWorksheet('Marcajes');

  ws.columns = [
    { key: 'cedula', width: 16 },
    { key: 'trabajador', width: 28 },
    { key: 'fecha', width: 12 },
    { key: 'hora_entrada', width: 12 },
    { key: 'ubicacion_entrada', width: 40 },
    { key: 'hora_salida', width: 12 },
    { key: 'ubicacion_salida', width: 40 },
    { key: 'sospechoso', width: 12 },
  ];

  const cabecera = ws.addRow([
    'Cédula', 'Trabajador', 'Fecha',
    'Hora entrada', 'Ubicación entrada',
    'Hora salida', 'Ubicación salida',
    'Sospechoso',
  ]);
  cabecera.font = { bold: true };

  for (const m of marcajes) {
    ws.addRow([
      m.cedula || '',
      `${m.trabajador_nombre} ${m.trabajador_apellido}`,
      m.fecha,
      m.hora_entrada || '',
      m.ubicacion_entrada || '',
      m.hora_salida || '',
      m.ubicacion_salida || '',
      m.sospechoso ? 'Sí' : 'No',
    ]);
  }
}

module.exports = { generarLiquidacionExcel };
