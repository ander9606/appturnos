'use strict';

const ExcelJS = require('exceljs');
const { generarLiquidacionExcel } = require('../utils/liquidacionExcel');

const linea = {
  cedula: '1', nombre: 'Ana', apellido: 'Ruiz', dias_registrados: 15,
  horas_ordinarias: 40, horas_extra_diurnas: 2, horas_extra_nocturnas: 1, horas_nocturnas: 3, horas_festivo: 4,
  valor_hora: 5000, total: 300000, descuento_salud: 12000, descuento_pension: 12000,
  subsidio_transporte: 100000, neto: 376000,
};
const liquidacion = (extra = {}) => ({
  periodo: { fecha_inicio: '2026-09-01', fecha_fin: '2026-09-15', estado: 'cerrado' },
  lineas: [linea],
  totales: { total_general: 300000, total_neto_general: 376000 },
  ...extra,
});

async function leer(liq) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await generarLiquidacionExcel(liq));
  const ws = wb.getWorksheet('Liquidación');
  let cabecera = null;
  ws.eachRow((row) => {
    if (!cabecera && row.values.includes('Cédula')) cabecera = row.values.slice(1);
  });
  let notaCabecera = null;
  ws.eachRow((row) => {
    row.eachCell((cell) => { if (cell.value === 'H. extra diurna') notaCabecera = cell.note; });
  });
  return { aviso: ws.getCell('A2').value, cabecera, notaCabecera, ws };
}

describe('liquidacionExcel: recargos automáticos', () => {
  test('con recargos muestra nocturnas, festivo y extra nocturna, sin aviso', async () => {
    const { aviso, cabecera } = await leer(liquidacion({ recargos_automaticos: true }));
    expect(cabecera).toEqual(expect.arrayContaining(['H. nocturnas', 'H. festivo', 'H. extra nocturna']));
    expect(aviso).toBeFalsy();
  });

  test('el encabezado de extras lleva una nota de celda: el tope de 42 h es semanal y cruza períodos', async () => {
    for (const recargos of [true, false]) {
      const { notaCabecera } = await leer(liquidacion({ recargos_automaticos: recargos }));
      expect(JSON.stringify(notaCabecera)).toMatch(/42 h es semanal.*cruza períodos/);
    }
  });

  test('sin recargos omite esas columnas, avisa y mantiene los totales', async () => {
    const { aviso, cabecera, ws } = await leer(liquidacion({ recargos_automaticos: false }));
    expect(cabecera).not.toEqual(expect.arrayContaining(['H. nocturnas', 'H. festivo', 'H. extra nocturna']));
    expect(cabecera).toContain('H. extra diurna');
    expect(aviso).toMatch(/Sin recargos automáticos/);
    // La fila TOTAL sigue en la misma columna que su encabezado.
    const col = cabecera.indexOf('Total neto') + 1;
    const fila = ws.getRow(ws.rowCount);
    expect(fila.getCell(col).value).toBe(376000);
  });
});
