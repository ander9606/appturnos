'use strict';

// La tabla "Datos del turno" reemplazó las cifras repetidas dentro de la
// prosa de las cláusulas (ver contratoPdf.js) — construirFilasTurno() decide
// qué filas aparecen (lugar/bono/descuentos son opcionales) y
// generarContratoPdf() debe poder dibujarla sin reventar contra pdfkit real
// (heightOfString, addPage, etc. — ahí es donde un mal uso de la API truena).
const { PassThrough } = require('stream');
const { generarContratoPdf, construirFilasTurno } = require('../utils/contratoPdf');

function contratoBase(overrides = {}) {
  return {
    numero_contrato: 'CT-2026-1',
    fecha: '2026-07-04',
    descripcion_labor: 'Montaje y desmontaje de carpas',
    oferta_titulo: 'Montajista',
    lugar: 'Bogotá',
    hora_inicio: '08:00:00',
    hora_fin_estimada: '17:00:00',
    valor_dia: 150000,
    bono_monto: 0,
    bono_motivo: null,
    descuentos: [],
    firmado_trabajador: 0,
    firma_b64: null,
    firmado_at: null,
    empresa_firma_representante_b64: null,
    empresa_representante_nombre: null,
    empresa_representante_cedula: null,
    empresa_nombre: 'Carpas Vento SAS',
    empresa_nit: '900.672.365-0',
    empresa_ciudad: 'Bogotá',
    empresa_direccion: null,
    trabajador_nombre: 'Adrián',
    trabajador_apellido: 'González',
    trabajador_cedula: '1.078.372.009',
    trabajador_tipo_documento: 'CC',
    trabajador_direccion: null,
    trabajador_eps: null,
    trabajador_afp: null,
    ...overrides,
  };
}

describe('construirFilasTurno', () => {
  test('fila mínima: sin lugar, sin bono, sin descuentos', () => {
    const filas = construirFilasTurno(contratoBase({ lugar: null }));
    expect(filas.map((f) => f[0])).toEqual(['Labor', 'Fecha', 'Horario', 'Valor del día']);
  });

  test('incluye lugar, bono y un descuento por cada uno en descuentos', () => {
    const filas = construirFilasTurno(contratoBase({
      bono_monto: 20000,
      bono_motivo: 'puntualidad',
      descuentos: [{ monto: 5000, motivo: 'daño menor' }, { monto: 3000, motivo: 'faltante' }],
    }));
    expect(filas.map((f) => f[0])).toEqual(['Labor', 'Lugar', 'Fecha', 'Horario', 'Valor del día', 'Bono', 'Descuento', 'Descuento']);
    expect(filas.find((f) => f[0] === 'Bono')[1]).toBe('$ 20.000 — puntualidad');
    expect(filas.filter((f) => f[0] === 'Descuento').map((f) => f[1])).toEqual([
      '-$ 5.000 — daño menor',
      '-$ 3.000 — faltante',
    ]);
  });

  test('bono en 0 no agrega fila', () => {
    const filas = construirFilasTurno(contratoBase({ bono_monto: 0 }));
    expect(filas.some((f) => f[0] === 'Bono')).toBe(false);
  });
});

describe('generarContratoPdf', () => {
  test('genera el PDF completo (con tabla) sin reventar, con datos mínimos', (done) => {
    const sink = new PassThrough();
    const chunks = [];
    sink.on('data', (c) => chunks.push(c));
    sink.on('finish', () => {
      expect(Buffer.concat(chunks).length).toBeGreaterThan(0);
      done();
    });
    generarContratoPdf(contratoBase({ lugar: null, trabajador_tipo_documento: null, trabajador_cedula: null }), sink);
  });

  test('genera el PDF con muchos descuentos (fuerza salto de página en la tabla) sin reventar', (done) => {
    const muchosDescuentos = Array.from({ length: 40 }, (_, i) => ({ monto: 1000 * (i + 1), motivo: `concepto ${i + 1}` }));
    const sink = new PassThrough();
    const chunks = [];
    sink.on('data', (c) => chunks.push(c));
    sink.on('finish', () => {
      expect(Buffer.concat(chunks).length).toBeGreaterThan(0);
      done();
    });
    generarContratoPdf(contratoBase({ descuentos: muchosDescuentos, bono_monto: 10000, bono_motivo: 'extra' }), sink);
  });
});
