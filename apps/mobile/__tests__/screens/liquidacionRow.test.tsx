/**
 * Fila de empleado del gestor: plegada muestra la barra de horas; al desplegar queda UNA sola barra (la grande, en
 * pesos, del desglose) — antes se veían dos seguidas contando casi lo mismo.
 */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { LiquidacionRow } from '../../features/nomina/LiquidacionRow';

jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return new Proxy({}, { get: () => ({ name }: { name: string }) => <Text testID={`icon-${name}`} /> });
});
jest.mock('@/features/nomina/descuentos/useDescuentos', () => ({ useCrearDescuento: () => ({ mutateAsync: jest.fn(), isPending: false }) }));
// La barra real usa estilos animables que necesitan el módulo nativo de Worklets (no existe en Jest).
jest.mock('@/components/ui/CompositionBar', () => {
  const { View } = require('react-native');
  return { CompositionBar: ({ height }: { height?: number }) => <View testID={`barra-${height}`} /> };
});

const linea = {
  trabajador_id: 1, nombre: 'Jair', apellido: 'Diaz', cedula: '1', banco: null, tipo_cuenta: null, numero_cuenta: null,
  dias_registrados: 7, dias_periodo: 15, horas_ordinarias: 40, horas_extra_diurnas: 0, horas_extra_nocturnas: 0,
  horas_nocturnas: 2.5, horas_festivo: 27.5, valor_hora: 8333, salario_base: 1750905, recargo_festivo: 1.9, recargo_nocturno: 0.35,
  pago_ordinario: 945900, pago_nocturno: 7883, pago_extra_diurno: 0, pago_extra_nocturno: 0, pago_festivo: 470698,
  total: 1424480, descuento_salud: 56979, descuento_pension: 56979, otros_descuentos: [], otros_descuentos_total: 0,
  subsidio_transporte: 124548, neto: 1435069,
} as never;

test('plegada: la barra de horas; desplegada: solo la barra grande del desglose', () => {
  render(<LiquidacionRow linea={linea} />);
  expect(screen.getAllByTestId(/^barra-/)).toHaveLength(1);
  expect(screen.getByTestId('barra-6')).toBeTruthy();

  fireEvent.press(screen.getByText('Jair Diaz'));
  expect(screen.getAllByTestId(/^barra-/)).toHaveLength(1);
  expect(screen.getByTestId('barra-10')).toBeTruthy();
  expect(screen.queryByTestId('barra-6')).toBeNull();

  fireEvent.press(screen.getByText('Jair Diaz'));
  expect(screen.getByTestId('barra-6')).toBeTruthy();
});
