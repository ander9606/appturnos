'use strict';

const ExcelJS = require('exceljs');

/**
 * Genera el libro Excel de una liquidación y devuelve su contenido como Buffer.
 * @param {object} liquidacion  Salida de LiquidacionService.generar.
 * @param {object[]} [marcajes]  Salida de LiquidacionService.marcajesConUbicacion — si
 *   se pasa, agrega una segunda hoja con el detalle diario de entrada/salida y ubicación.
 * @returns {Promise<Buffer>}
 */
async function generarLiquidacionExcel(liquidacion, marcajes) {
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
    { key: 'salud', width: 14 },
    { key: 'pension', width: 14 },
    { key: 'transporte', width: 18 },
    { key: 'neto', width: 16 },
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
    'Total bruto',
    'Descuento salud',
    'Descuento pensión',
    'Auxilio transporte',
    'Total neto',
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
      l.descuento_salud,
      l.descuento_pension,
      l.subsidio_transporte,
      l.neto,
    ]);
  }

  const filaTotal = ws.addRow([
    '', 'TOTAL', '', '', '', '', '', '', '',
    liquidacion.totales.total_general, '', '', '', liquidacion.totales.total_neto_general,
  ]);
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
