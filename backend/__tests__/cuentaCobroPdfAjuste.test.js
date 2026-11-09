'use strict';

// Cuenta de ajuste: un turno ya cobrado que se dio por fallido con una compensación menor genera una cuenta
// con valor NEGATIVO. El PDF debe leerse bien ("- $ 20.000", no "$ -20.000") y decir que es de ajuste.
const { PassThrough } = require('stream');
const PDFDocument = require('pdfkit');
const { generarCuentaCobroPdf } = require('../utils/cuentaCobroPdf');

async function textos(valor) {
  const dibujados = [];
  const original = PDFDocument.prototype.text;
  const espia = jest.spyOn(PDFDocument.prototype, 'text').mockImplementation(function (texto, ...resto) {
    dibujados.push(String(texto));
    return original.call(this, texto, ...resto);
  });
  try {
    await new Promise((resolve, reject) => {
      const s = new PassThrough(); s.on('data', () => {}); s.on('end', resolve); s.on('error', reject);
      generarCuentaCobroPdf({
        empresa_id: 1, empresa_nombre: 'Acme', trabajador_nombre: 'Ana', trabajador_apellido: 'Pérez', trabajador_cedula: '1',
        fecha_inicio: '2030-01-01', fecha_fin: '2030-01-15', numero_cuenta: 'CC-1-2', secuencia: 2, firmado_trabajador: 0,
        items: [{
          asignacion_id: 1, fecha: '2030-01-03', descripcion: 'Montaje (ajuste por turno fallido)', cargo: 'Auxiliar',
          lugar: 'Bodega', horas: 0, valor_base: valor, pago_extra: 0, bono_monto: 0, descuento_monto: 0, valor,
        }],
        total_turnos: 1, total_horas: 0, valor_total: valor,
      }, s).catch(reject);
    });
  } finally { espia.mockRestore(); }
  return dibujados;
}

test('total negativo: se imprime "- $ 20.000" y se rotula como cuenta de ajuste', async () => {
  const t = await textos(-20000);
  expect(t).toContain('VALOR TOTAL: - $ 20.000');
  expect(t).toContain('- $ 20.000');
  expect(t.some((x) => x.startsWith('Cuenta de ajuste'))).toBe(true);
  expect(t.some((x) => x.includes('$ -'))).toBe(false);
});

test('total positivo en cuenta complementaria: igual que antes', async () => {
  const t = await textos(20000);
  expect(t).toContain('VALOR TOTAL: $ 20.000');
  expect(t.some((x) => x.startsWith('Cuenta complementaria'))).toBe(true);
  expect(t.some((x) => x.startsWith('Cuenta de ajuste'))).toBe(false);
});
