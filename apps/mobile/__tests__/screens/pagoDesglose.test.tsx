/**
 * Desglose del pago (trabajador y gestor): filas cortas por concepto con su monto, la cuenta solo al tocar, y
 * bruto → descuentos → auxilio → neto cuando los hay. Indicador de pasos del período.
 */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { PagoDesglose } from '../../features/nomina/PagoDesglose';
import { PeriodoPasos } from '../../features/nomina/PeriodoPasos';

jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return new Proxy({}, { get: () => ({ name }: { name: string }) => <Text testID={`icon-${name}`} /> });
});

// La barra usa estilos animables que necesitan el módulo nativo de Worklets (no existe en Jest): aquí solo importa
// que reciba un segmento por concepto.
let mockSegmentos: { value: number }[] = [];
jest.mock('@/components/ui/CompositionBar', () => ({
  CompositionBar: ({ segments }: { segments: { value: number }[] }) => { mockSegmentos = segments; return null; },
}));

const linea = (o: Record<string, unknown> = {}) => ({
  trabajador_id: 1, nombre: 'A', apellido: 'B', dias_registrados: 12, dias_periodo: 15,
  horas_ordinarias: 96, horas_extra_diurnas: 4.5, horas_extra_nocturnas: 0, horas_nocturnas: 0, horas_festivo: 0,
  valor_hora: 8333.33, salario_base: 1750905, recargo_festivo: 1.9, recargo_nocturno: 0.35,
  pago_ordinario: 875452, pago_nocturno: 0, pago_extra_diurno: 46875, pago_extra_nocturno: 0, pago_festivo: 0,
  total: 922327, descuento_salud: 36893, descuento_pension: 36893, otros_descuentos: [], otros_descuentos_total: 0,
  subsidio_transporte: 124548, neto: 973089, ...o,
}) as never;

test('muestra un concepto por fila, bruto, descuentos, auxilio y neto; la cuenta aparece al tocar', () => {
  render(<PagoDesglose linea={linea()} />);
  expect(screen.getByText('Salario base')).toBeTruthy();
  expect(screen.getByText('Extra diurna · 4.5h')).toBeTruthy();
  expect(screen.getByText('Bruto')).toBeTruthy();
  expect(screen.getByText('Salud (4%)')).toBeTruthy();
  expect(screen.getByText('Auxilio de transporte')).toBeTruthy();
  expect(screen.getByText('Neto a pagar')).toBeTruthy();
  expect(screen.getByText('$973.089')).toBeTruthy();
  // La barra recibe un segmento por concepto, en pesos, y suman el bruto.
  expect(mockSegmentos.map((x) => x.value)).toEqual([875452, 46875]);

  expect(screen.queryByText(/÷ 30 × 15 días/)).toBeNull();
  fireEvent.press(screen.getByText('Salario base'));
  expect(screen.getByText(/÷ 30 × 15 días/)).toBeTruthy();
  fireEvent.press(screen.getByText('Salario base'));
  expect(screen.queryByText(/÷ 30 × 15 días/)).toBeNull();
});

test('sin descuentos ni auxilio: una sola línea «Total a pagar», sin bruto/neto repetidos', () => {
  render(<PagoDesglose linea={linea({
    horas_extra_diurnas: 0, pago_extra_diurno: 0, total: 875452, neto: 875452,
    descuento_salud: 0, descuento_pension: 0, subsidio_transporte: 0,
  })} />);
  expect(screen.getByText('Total a pagar')).toBeTruthy();
  expect(screen.queryByText('Bruto')).toBeNull();
  expect(screen.queryByText('Neto a pagar')).toBeNull();
});

test('PeriodoPasos describe el paso actual para lectores de pantalla', () => {
  render(<PeriodoPasos estado="cerrado" />);
  expect(screen.getByLabelText('Período cerrado, paso 2 de 3')).toBeTruthy();
});
