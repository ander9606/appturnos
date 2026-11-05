'use strict';

// La cuenta de cobro agrupa los ítems por grupo de turnos, con un subtotal por grupo. Si ningún ítem tiene grupo
// (empresas que no usan grupos) devuelve null y el PDF se dibuja como siempre.
const { PassThrough } = require('stream');
const { agruparItemsPorGrupo, generarCuentaCobroPdf } = require('../utils/cuentaCobroPdf');

const item = (n, valor, extra = {}) => ({
  asignacion_id: n, fecha: `2030-01-0${n}`, descripcion: `Turno ${n}`, horas: 8, valor_base: valor,
  pago_extra: 0, bono_monto: 0, descuento_monto: 0, valor, ...extra,
});

describe('agruparItemsPorGrupo', () => {
  test('sin ningún grupo devuelve null (lista plana de siempre)', () => {
    expect(agruparItemsPorGrupo([item(1, 50000), item(2, 60000)])).toBeNull();
    expect(agruparItemsPorGrupo([])).toBeNull();
  });

  test('agrupa por grupo con su subtotal y deja "sin grupo" al final', () => {
    const items = [
      item(1, 50000, { grupo_id: 3, grupo_nombre: 'Feria' }),
      item(2, 40000),
      item(3, 60000, { grupo_id: 3, grupo_nombre: 'Feria' }),
      item(4, 55000, { grupo_id: 9, grupo_nombre: 'Obra' }),
    ];
    const secciones = agruparItemsPorGrupo(items);
    expect(secciones.map((s) => [s.nombre, s.subtotal, s.items.length])).toEqual([
      ['Feria', 110000, 2], ['Obra', 55000, 1], [null, 40000, 1],
    ]);
  });

  test('los subtotales suman exactamente el total de la cuenta (centavos incluidos)', () => {
    const items = [
      item(1, 10.1, { grupo_id: 1, grupo_nombre: 'A' }),
      item(2, 20.2, { grupo_id: 1, grupo_nombre: 'A' }),
      item(3, 0.3),
    ];
    const total = agruparItemsPorGrupo(items).reduce((s, x) => s + x.subtotal, 0);
    expect(Math.round(total * 100) / 100).toBe(30.6);
  });

  test('dos grupos con el mismo nombre se mantienen separados (se distinguen por id)', () => {
    const secciones = agruparItemsPorGrupo([
      item(1, 100, { grupo_id: 1, grupo_nombre: 'Feria' }),
      item(2, 200, { grupo_id: 2, grupo_nombre: 'Feria' }),
    ]);
    expect(secciones).toHaveLength(2);
  });

  test('un ítem con grupo_id pero sin nombre no rompe: usa "Grupo"', () => {
    expect(agruparItemsPorGrupo([item(1, 1, { grupo_id: 5, grupo_nombre: null })])[0].nombre).toBe('Grupo');
  });
});

describe('generarCuentaCobroPdf', () => {
  const cuenta = (items) => ({
    empresa_id: 1, empresa_nombre: 'Acme', trabajador_nombre: 'Ana', trabajador_apellido: 'Test', trabajador_cedula: '1',
    fecha_inicio: '2030-01-01', fecha_fin: '2030-01-15', numero_cuenta: 'CC-1-2', secuencia: 1, firmado_trabajador: 0,
    items, total_turnos: items.length, total_horas: items.length * 8,
    valor_total: items.reduce((s, i) => s + i.valor, 0),
  });
  const genera = (c) => new Promise((resolve, reject) => {
    const s = new PassThrough(); const partes = [];
    s.on('data', (d) => partes.push(d)); s.on('end', () => resolve(Buffer.concat(partes))); s.on('error', reject);
    generarCuentaCobroPdf(c, s).catch(reject);
  });

  test('con y sin grupos produce un PDF válido (también con muchos ítems, que saltan de página)', async () => {
    const muchos = Array.from({ length: 40 }, (_, i) => item(i % 9 + 1, 1000, { grupo_id: i % 3 ? 3 : null, grupo_nombre: i % 3 ? 'Feria' : null }));
    for (const items of [[item(1, 5)], [item(1, 5, { grupo_id: 3, grupo_nombre: 'Feria' })], muchos]) {
      const pdf = await genera(cuenta(items));
      expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    }
  });
});
