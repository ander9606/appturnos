'use strict';

const ExcelJS = require('exceljs');

/**
 * Genera el libro Excel de una liquidación y devuelve su contenido como Buffer.
 * @param {object} liquidacion  Salida de LiquidacionService.generar.
 * @returns {Promise<Buffer>}
 */
async function generarLiquidacionExcel(liquidacion) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'App Turnos';
  const ws = wb.addWorksheet('Liquidación');

  const { periodo } = liquidacion;
  ws.mergeCells('A1', 'J1');
  ws.getCell('A1').value =
    `Liquidación período ${periodo.fecha_inicio} a ${periodo.fecha_fin} (${periodo.estado})`;
  ws.getCell('A1').font = { bold: true, size: 13 };
  ws.addRow([]);

  ws.columns = [
    { key: 'cedula', width: 16 },
    { key: 'trabajador', width: 30 },
    { key: 'dias', width: 8 },
    { key: 'ord', width: 14 },
    { key: 'ed', width: 16 },
    { key: 'en', width: 18 },
    { key: 'noc', width: 14 },
    { key: 'fes', width: 12 },
    { key: 'vh', width: 14 },
    { key: 'total', width: 16 },
  ];

  const cabecera = ws.addRow([
    'Cédula',
    'Trabajador',
    'Días',
    'H. ordinarias',
    'H. extra diurna',
    'H. extra nocturna',
    'H. nocturnas',
    'H. festivo',
    'Valor hora',
    'Total',
  ]);
  cabecera.font = { bold: true };

  for (const l of liquidacion.lineas) {
    ws.addRow([
      l.cedula || '',
      `${l.nombre} ${l.apellido}`,
      l.dias_registrados,
      l.horas_ordinarias,
      l.horas_extra_diurnas,
      l.horas_extra_nocturnas,
      l.horas_nocturnas,
      l.horas_festivo,
      l.valor_hora,
      l.total,
    ]);
  }

  const filaTotal = ws.addRow(['', 'TOTAL', '', '', '', '', '', '', '', liquidacion.totales.total_general]);
  filaTotal.font = { bold: true };

  return wb.xlsx.writeBuffer();
}

module.exports = { generarLiquidacionExcel };
