'use strict';

// Cláusula de fuerza mayor del contrato diario. El PDF se genera al descargarlo, así que la cláusula solo
// debe salir en los contratos creados con ella (clausula_fuerza_mayor = 1); en los anteriores el documento
// no puede cambiar (puede estar firmado). Ver migración 123.
const { PassThrough } = require('stream');
const { construirClausulas, generarContratoPdf } = require('../utils/contratoPdf');

const base = (extra = {}) => ({
  numero_contrato: 'CT-2026-1', fecha: '2026-11-03', descripcion_labor: 'Mesero', oferta_titulo: 'Montaje Gala',
  empresa_nombre: 'Acme S.A.S.', trabajador_nombre: 'Ana', trabajador_apellido: 'Ruiz',
  hora_inicio: '08:00:00', hora_fin_estimada: '16:00:00', valor_dia: 120000, bono_monto: 0, descuentos: [],
  firmado_trabajador: 0, ...extra,
});

describe('contrato diario — cláusula de fuerza mayor', () => {
  test('contrato nuevo (clausula_fuerza_mayor = 1): lleva la cláusula con el mínimo vigente y el pago según contrato', () => {
    const { clausulas } = construirClausulas(base({ clausula_fuerza_mayor: 1 }));
    const [titulo, cuerpo] = clausulas[clausulas.length - 1];
    expect(titulo).toBe('UNDÉCIMA — FUERZA MAYOR');
    expect(cuerpo).toContain('después de que EL CONTRATISTA haya iniciado la labor');
    expect(cuerpo).toContain('al menos el 50 % del valor del día');
    expect(cuerpo).toContain('Si la labor se realiza, EL CONTRATANTE la pagará conforme a lo previsto en la cláusula TERCERA');
  });

  test.each([[0], [null], [undefined]])('contrato anterior (clausula_fuerza_mayor = %s): su PDF no cambia', (valor) => {
    const { clausulas } = construirClausulas(base({ clausula_fuerza_mayor: valor }));
    expect(clausulas).toHaveLength(10);
    expect(clausulas.some(([t]) => t.includes('FUERZA MAYOR'))).toBe(false);
  });

  test('el PDF se genera completo con la cláusula (pdfkit real)', async () => {
    await new Promise((resolve, reject) => {
      const s = new PassThrough(); s.on('data', () => {}); s.on('end', resolve); s.on('error', reject);
      try { generarContratoPdf(base({ clausula_fuerza_mayor: 1 }), s); } catch (e) { reject(e); }
    });
  });
});
