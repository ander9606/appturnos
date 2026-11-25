import { desglosePago } from '../pagoDesglose';

const linea = (o: Record<string, unknown> = {}) => ({
  trabajador_id: 1, nombre: 'A', apellido: 'B', dias_registrados: 12, dias_periodo: 15,
  horas_ordinarias: 96, horas_extra_diurnas: 0, horas_extra_nocturnas: 0, horas_nocturnas: 0, horas_festivo: 0,
  valor_hora: 8333.33, salario_base: 1750905, recargo_festivo: 1.9, recargo_nocturno: 0.35,
  pago_ordinario: 875452, pago_nocturno: 0, pago_extra_diurno: 0, pago_extra_nocturno: 0, pago_festivo: 0,
  total: 875452, descuento_salud: 35018, descuento_pension: 35018, otros_descuentos: [], otros_descuentos_total: 0,
  subsidio_transporte: 124548, neto: 929964, ...o,
}) as never;

describe('desglosePago', () => {
  it('solo base: un concepto, descuentos de ley y el auxilio fuera del bruto', () => {
    const d = desglosePago(linea());
    expect(d.conceptos.map((c) => c.clave)).toEqual(['base']);
    expect(d.conceptos[0].formula).toBe('$1.750.905 ÷ 30 × 15 días (no depende de las horas)');
    expect(d.bruto).toBe(875452);
    expect(d.descuentos.map((x) => x.label)).toEqual(['Salud (4%)', 'Pensión']);
    expect(d.auxilio).toBe(124548);
    // neto = bruto − descuentos + auxilio
    expect(d.bruto - d.descuentos.reduce((s, x) => s + x.monto, 0) + d.auxilio).toBe(d.neto);
  });

  it('los conceptos con monto 0 no aparecen; los que tienen, suman el bruto', () => {
    const d = desglosePago(linea({
      horas_extra_diurnas: 4.5, pago_extra_diurno: 46875, horas_festivo: 8, pago_festivo: 126667,
      total: 875452 + 46875 + 126667,
    }));
    expect(d.conceptos.map((c) => c.clave)).toEqual(['base', 'extraDiurna', 'festivo']);
    expect(d.conceptos.reduce((s, c) => s + c.monto, 0)).toBe(d.bruto);
    expect(d.conceptos[1].label).toBe('Extra diurna · 4.5h');
    expect(d.conceptos[1].formula).toBe('4.5h × $8.333 × 1.25');
    expect(d.conceptos[2].formula).toContain('× 1.9');
  });

  it('contratista (sin salud ni pensión) con un descuento aceptado: lo muestra con su motivo', () => {
    const d = desglosePago(linea({
      descuento_salud: 0, descuento_pension: 0, subsidio_transporte: 0,
      otros_descuentos: [{ id: 7, tipo: 'anticipo', motivo: 'Adelanto 12 nov', monto: 100000 }], neto: 775452,
    }));
    expect(d.descuentos).toEqual([{ clave: 'd7', label: 'Anticipo · Adelanto 12 nov', monto: 100000 }]);
    expect(d.auxilio).toBe(0);
  });

  it('por tarifa hora (sin salario base): la base es horas × valor', () => {
    const d = desglosePago(linea({ salario_base: null, horas_ordinarias: 40 }));
    expect(d.conceptos[0].label).toBe('Horas ordinarias · 40.0h');
    expect(d.conceptos[0].formula).toBe('40.0h × $8.333');
  });
});
