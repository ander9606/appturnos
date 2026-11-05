import type { CuentaCobroItem } from '@api-client';
import { agruparItemsCuenta } from '../cuentaCobroGrupos';

const item = (n: number, valor: number, extra: Partial<CuentaCobroItem> = {}): CuentaCobroItem => ({
  asignacion_id: n, fecha: `2030-01-0${n}`, descripcion: `Turno ${n}`, cargo: null, lugar: null, hora_inicio: null, hora_fin: null,
  horas: 8, valor_base: valor, pago_extra: 0, bono_monto: 0, bono_motivo: null, valor, ...extra,
});

describe('agruparItemsCuenta', () => {
  test('sin ningún grupo devuelve null (la cuenta se ve plana, como siempre)', () => {
    expect(agruparItemsCuenta([item(1, 50000), item(2, 60000)])).toBeNull();
    expect(agruparItemsCuenta([])).toBeNull();
  });

  test('agrupa con su subtotal y deja "sin grupo" al final', () => {
    const secciones = agruparItemsCuenta([
      item(1, 50000, { grupo_id: 3, grupo_nombre: 'Feria' }),
      item(2, 40000),
      item(3, 60000, { grupo_id: 3, grupo_nombre: 'Feria' }),
      item(4, 55000, { grupo_id: 9, grupo_nombre: 'Obra' }),
    ])!;
    expect(secciones.map((s) => [s.nombre, s.subtotal, s.items.length])).toEqual([
      ['Feria', 110000, 2], ['Obra', 55000, 1], [null, 40000, 1],
    ]);
  });

  test('los subtotales suman el total de la cuenta', () => {
    const items = [
      item(1, 10.1, { grupo_id: 1, grupo_nombre: 'A' }), item(2, 20.2, { grupo_id: 2, grupo_nombre: 'B' }), item(3, 0.3),
    ];
    const suma = agruparItemsCuenta(items)!.reduce((t, s) => t + s.subtotal, 0);
    expect(Math.round(suma * 100) / 100).toBe(30.6);
  });

  test('dos grupos con el mismo nombre no se mezclan; sin nombre usa "Grupo"', () => {
    expect(agruparItemsCuenta([
      item(1, 1, { grupo_id: 1, grupo_nombre: 'Feria' }), item(2, 1, { grupo_id: 2, grupo_nombre: 'Feria' }),
    ])).toHaveLength(2);
    expect(agruparItemsCuenta([item(1, 1, { grupo_id: 5, grupo_nombre: null })])![0].nombre).toBe('Grupo');
  });
});
